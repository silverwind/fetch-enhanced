import {HttpProxyAgent, HttpsProxyAgent} from "hpagent";
import QuickLRU from "quick-lru";
import {getProxyForUrl} from "proxy-from-env";
import {Agent as HttpAgent} from "node:http";
import {Agent as HttpsAgent} from "node:https";

const defaultModuleOpts = {
  agentCacheSize: 512,
};

const defaultAgentOpts = {
  maxSockets: 64,
  keepAlive: false,
};

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
    Error.captureStackTrace?.(this, TimeoutError);
  }
}

export default function fetchEnhanced(fetchImplementation, moduleOpts = {}) {
  if (!("undici" in moduleOpts)) throw new Error(`The 'undici' option is required`);
  const opts = {...defaultModuleOpts, ...moduleOpts};
  const agentCache = new QuickLRU({maxSize: opts.agentCacheSize});

  async function getAgent(url, agentOpts = {}) {
    const {origin, protocol} = new URL(url);
    const proxyUrl = agentOpts?.noProxy ? null : getProxyForUrl(url);

    const agentCacheKey = JSON.stringify({proxyUrl, origin, ...agentOpts});
    if (agentCache.has(agentCacheKey)) return agentCache.get(agentCacheKey);

    let agent;
    if ("noProxy" in agentOpts) delete agentOpts.noProxy;

    if (moduleOpts.undici) {
      // https://github.com/nodejs/undici/blob/main/docs/api/Client.md#parameter-clientoptions
      const undiciOpts = {...agentOpts};

      // undici supports disabling keepAlive via pipelining = 0
      if (("keepAlive" in undiciOpts) && !("pipelining" in undiciOpts)) {
        undiciOpts.pipelining = undiciOpts.keepAlive ? 1 : 0;
      }
      if ("keepAlive" in undiciOpts) {
        delete undiciOpts.keepAlive;
      }

      // undici supports limiting parallel sockets via connections
      if ("maxSockets" in undiciOpts) {
        undiciOpts.connections = undiciOpts.maxSockets;
        delete undiciOpts.maxSockets;
      }

      let UndiciProxyAgent, UndiciAgent, hadError;
      try {
        ({ProxyAgent: UndiciProxyAgent, Agent: UndiciAgent} = await import("undici"));
      } catch {
        hadError = true;
      }

      if (proxyUrl && hadError) {
        throw new Error(`Please install the "undici" package to enable proxy support`);
      }

      if (proxyUrl && UndiciProxyAgent) {
        agent = new UndiciProxyAgent({...undiciOpts, uri: proxyUrl});
      } else if (UndiciAgent) {
        agent = new UndiciAgent(undiciOpts);
      }
    } else {
      const isHttps = protocol === "https:";

      if (proxyUrl) {
        agent = new (isHttps ? HttpsProxyAgent : HttpProxyAgent)({...agentOpts, proxy: proxyUrl});
      } else {
        agent = new (isHttps ? HttpsAgent : HttpAgent)(agentOpts);
      }
    }

    agentCache.set(agentCacheKey, agent);
    return agent;
  }

  const fetch = (url, {timeout = 0, agentOpts = {}, ...opts} = {}) => {
    return new Promise(async (resolve, reject) => {
      // proxy
      if (!moduleOpts.undici && !("agent" in opts)) {
        const agent = await getAgent(url, {...defaultAgentOpts, ...agentOpts});
        if (agent) opts.agent = agent;
      } else if (moduleOpts.undici && !("dispatcher" in opts)) {
        const agent = await getAgent(url, {...defaultAgentOpts, ...agentOpts});
        if (agent) opts.dispatcher = agent;
      }

      // timeout
      let timeoutId, controller;
      if (timeout) {
        if (!("signal" in opts) && globalThis.AbortController) {
          controller = new AbortController();
          opts.signal = controller.signal;
        }

        timeoutId = setTimeout(() => {
          controller?.abort?.();
          const err = new TimeoutError(`${opts.method || "GET"} ${url} timed out after ${timeout}ms`);
          reject(err);
        }, timeout);
        timeoutId?.unref?.();
      }

      fetchImplementation(url, opts).then(res => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(res);
      }).catch(err => {
        if (timeoutId) clearTimeout(timeoutId);
        if (err.name === "AbortError") return resolve(null);
        reject(err);
      });
    });
  };

  fetch.clearCache = () => {
    for (const agent of agentCache.values()) {
      if ("destroy" in agent) agent.destroy();
    }
    agentCache.clear();
  };

  return fetch;
}
