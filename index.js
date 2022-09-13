import {ProxyAgent as UndiciProxyAgent, Agent as UndiciAgent} from "undici";
import {HttpProxyAgent, HttpsProxyAgent} from "hpagent";
import QuickLRU from "quick-lru";
import {getProxyForUrl} from "proxy-from-env";
import {Agent as HttpAgent} from "http";
import {Agent as HttpsAgent} from "https";

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
    Error.captureStackTrace(this, TimeoutError);
  }
}

export default function fetchEnhanced(fetchImplementation, moduleOpts = {}) {
  const opts = {...defaultModuleOpts, ...moduleOpts};
  const agentCache = new QuickLRU({maxSize: opts.agentCacheSize});

  function getAgent(url, agentOpts = {}, isUndici) {
    const {origin, protocol} = new URL(url);

    const agentCacheKey = JSON.stringify({origin, ...agentOpts});
    if (agentCache.peek(agentCacheKey)) return agentCache.get(agentCacheKey);

    let agent;
    const isHttps = protocol === "https:";
    const proxyUrl = getProxyForUrl(url);

    if (isUndici) {
      // https://github.com/nodejs/undici/blob/main/docs/api/Client.md#parameter-clientoptions
      const undiciOpts = {...agentOpts};

      // undici does not support keepAlive option
      if ("keepAlive" in undiciOpts) {
        undiciOpts.pipelining = undiciOpts.keepAlive ? 1 : 0;
        delete undiciOpts.keepAlive;
      }

      // undici does not support maxSockets option
      if ("maxSockets" in undiciOpts) {
        delete undiciOpts.maxSockets;
      }

      if (proxyUrl) {
        agent = new UndiciProxyAgent({...undiciOpts, uri: proxyUrl});
      } else {
        agent = new UndiciAgent(undiciOpts);
      }
    } else {
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
    return new Promise((resolve, reject) => {
      const isUndici = fetchImplementation === globalThis.fetch;

      // proxy
      if (!isUndici && !("agent" in opts)) {
        opts.agent = getAgent(url, {...defaultAgentOpts, ...agentOpts}, isUndici);
      } else if (isUndici && !("dispatcher" in opts)) {
        opts.dispatcher = getAgent(url, {...defaultAgentOpts, ...agentOpts}, isUndici);
      }

      // timeout
      let timeoutId;
      if (timeout) {
        timeoutId = setTimeout(() => {
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
