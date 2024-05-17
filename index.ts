import {HttpProxyAgent, HttpsProxyAgent} from "hpagent";
import QuickLRU from "quick-lru";
import {getProxyForUrl} from "proxy-from-env";
import {Agent as HttpAgent} from "node:http";
import {Agent as HttpsAgent} from "node:https";
import type {AgentOptions} from "node:https";
import type {Agent as UndiciAgentType, ProxyAgent as UndiciProxyAgentType} from "undici";

type FetchEnhancedRequestInput = string | URL;
type AnyAgent = UndiciProxyAgentType | UndiciAgentType | HttpAgent | HttpsAgent;
type AgentOpts = AgentOptions & {noProxy?: boolean};
type AgentCache = QuickLRU<FetchEnhancedRequestInput, AnyAgent>;
type ModuleOpts = {undici: boolean, agentCacheSize?: number};
type ProxyUrl = string | null;

type FetchOpts = RequestInit & {
  timeout?: number,
  agent?: AnyAgent,
  dispatcher?: AnyAgent,
  agentOpts?: AgentOpts,
};

const defaultAgentOpts: AgentOpts = {
  maxSockets: 64,
  keepAlive: false,
};

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
    Error.captureStackTrace?.(this, TimeoutError);
  }
}

const inputToUrl = (url: FetchEnhancedRequestInput) => (url instanceof URL ? url : new URL(url));
const inputToStr = (url: FetchEnhancedRequestInput) => (url instanceof URL ? String(url) : url);

export default function fetchEnhanced(fetchImplementation: any, {undici = false, agentCacheSize = 512}: ModuleOpts = {undici: false}) {
  const agentCache: AgentCache = new QuickLRU({maxSize: agentCacheSize});

  async function getAgent(url: FetchEnhancedRequestInput, agentOpts: AgentOpts = {}) {
    const {origin, protocol} = inputToUrl(url);
    const proxyUrl: ProxyUrl = agentOpts?.noProxy ? null : getProxyForUrl(url);

    const agentCacheKey = JSON.stringify({proxyUrl, origin, ...agentOpts});
    if (agentCache.has(agentCacheKey)) return agentCache.get(agentCacheKey);

    let agent: UndiciProxyAgentType | UndiciAgentType | HttpAgent | HttpsAgent;
    if ("noProxy" in agentOpts) delete agentOpts.noProxy;

    if (undici) {
      // https://github.com/nodejs/undici/blob/main/docs/api/Client.md#parameter-clientoptions
      const undiciOpts: UndiciAgentType.Options = {...agentOpts as UndiciAgentType.Options};

      // undici supports disabling keepAlive via pipelining = 0
      if (("keepAlive" in undiciOpts) && !("pipelining" in undiciOpts)) {
        undiciOpts.pipelining = undiciOpts.keepAlive ? 1 : 0; // eslint-disable-line etc/no-deprecated
      }
      if ("keepAlive" in undiciOpts) {
        delete undiciOpts.keepAlive; // eslint-disable-line etc/no-deprecated
      }

      // undici supports limiting parallel sockets via connections
      if ("maxSockets" in undiciOpts && typeof undiciOpts.maxSockets === "number") {
        undiciOpts.connections = undiciOpts.maxSockets;
        delete undiciOpts.maxSockets;
      }

      let UndiciProxyAgent: any;
      let UndiciAgent: any;
      let hadError: boolean = false;
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

  const fetch = (url: FetchEnhancedRequestInput, {timeout = 0, agentOpts = {}, ...opts}: FetchOpts = {}): Promise<Response> => {
    return new Promise(async (resolve, reject) => {
      // proxy
      if (!undici && !("agent" in opts)) {
        const agent = await getAgent(url, {...defaultAgentOpts, ...agentOpts});
        if (agent) opts.agent = agent;
      } else if (undici && !("dispatcher" in opts)) {
        const agent = await getAgent(url, {...defaultAgentOpts, ...agentOpts});
        if (agent) opts.dispatcher = agent;
      }

      // timeout
      let timeoutId: any;
      let controller: AbortController;
      if (timeout) {
        if (!("signal" in opts) && globalThis.AbortController) {
          controller = new AbortController();
          opts.signal = controller.signal;
        }

        timeoutId = setTimeout(() => {
          controller?.abort?.();
          const err = new TimeoutError(`${opts.method || "GET"} ${inputToStr(url)} timed out after ${timeout}ms`);
          reject(err);
        }, timeout);
        timeoutId?.unref?.();
      }

      fetchImplementation(url, opts).then((res: Response) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(res);
      }).catch((err: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (err.name === "AbortError") return resolve(new Response());
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
