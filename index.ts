import {HttpProxyAgent, HttpsProxyAgent} from "hpagent";
import QuickLRU from "quick-lru";
import {getProxyForUrl} from "proxy-from-env";
import {Agent as HttpAgent} from "node:http";
import {Agent as HttpsAgent} from "node:https";
import type {AgentOptions} from "node:https";
import type {Agent as UndiciAgentType, ProxyAgent as UndiciProxyAgentType} from "undici";

export type FetchEnhancedRequestInput = string | URL;
export type FetchEnhancedAgent = UndiciProxyAgentType | UndiciAgentType | HttpAgent | HttpsAgent;
export type FetchEnhancedAgentsOpts = AgentOptions & {noProxy?: boolean};
type ModuleOpts = {undici: boolean, agentCacheSize?: number};

export type FetchOpts = {
  timeout?: number,
  agent?: FetchEnhancedAgent,
  dispatcher?: FetchEnhancedAgent,
  agentOpts?: FetchEnhancedAgentsOpts,
} & RequestInit;

const defaultAgentOpts: FetchEnhancedAgentsOpts = {
  maxSockets: 64,
  keepAlive: false,
};

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

const inputToStr = (url: FetchEnhancedRequestInput) => (url instanceof URL ? String(url) : url);

export default function fetchEnhanced(fetchImplementation: any, {undici, agentCacheSize}: ModuleOpts = {undici: false}) {
  const agentCache = new QuickLRU<string, FetchEnhancedAgent>({maxSize: agentCacheSize ?? 512});
  const agentKey = undici ? "dispatcher" : "agent";

  async function getAgent(url: FetchEnhancedRequestInput, agentOpts: FetchEnhancedAgentsOpts) {
    const {origin, protocol} = url instanceof URL ? url : new URL(url);
    const proxyUrl = agentOpts.noProxy ? null : getProxyForUrl(inputToStr(url));

    const agentCacheKey = JSON.stringify({proxyUrl, origin, ...agentOpts});
    const cachedAgent = agentCache.get(agentCacheKey);
    if (cachedAgent) return cachedAgent;

    let agent: FetchEnhancedAgent | undefined;
    delete agentOpts.noProxy;

    if (undici) {
      // https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md#new-clienturl-options
      const {keepAlive, ...undiciOpts}: Record<string, any> = agentOpts;

      // undici supports disabling keepAlive via pipelining = 0
      if (!("pipelining" in undiciOpts)) {
        undiciOpts.pipelining = keepAlive ? 1 : 0;
      }

      // undici supports limiting parallel sockets via connections
      if (typeof undiciOpts.maxSockets === "number") {
        undiciOpts.connections = undiciOpts.maxSockets;
        delete undiciOpts.maxSockets;
      }

      let UndiciProxyAgent: any;
      let UndiciAgent: any;
      try {
        ({ProxyAgent: UndiciProxyAgent, Agent: UndiciAgent} = await import("undici"));
      } catch {
        if (proxyUrl) throw new Error(`Please install the "undici" package to enable proxy support`);
      }

      if (proxyUrl && UndiciProxyAgent) {
        agent = new UndiciProxyAgent({...undiciOpts, uri: proxyUrl, proxyTunnel: true});
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

    if (agent) {
      agentCache.set(agentCacheKey, agent);
    }
    return agent;
  }

  const fetch = (url: FetchEnhancedRequestInput, {timeout, agentOpts, ...opts}: FetchOpts = {}): Promise<Response> => {
    return new Promise(async (resolve, reject) => {
      let timeoutId: any;
      try {
        if (!(agentKey in opts)) {
          const agent = await getAgent(url, {...defaultAgentOpts, ...agentOpts});
          if (agent) opts[agentKey] = agent;
        }

        if (timeout) {
          let controller: AbortController | undefined;
          if (!("signal" in opts)) {
            controller = new AbortController();
            opts.signal = controller.signal;
          }

          timeoutId = setTimeout(() => {
            controller?.abort();
            reject(new TimeoutError(`${opts.method || "GET"} ${inputToStr(url)} timed out after ${timeout}ms`));
          }, timeout);
          timeoutId.unref?.();
        }

        resolve(await fetchImplementation(url, opts));
      } catch (err) {
        const error = err as Error;
        if (error?.name === "AbortError") resolve(new Response());
        else reject(error);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  };

  fetch.clearCache = () => {
    for (const agent of agentCache.values()) {
      agent.destroy();
    }
    agentCache.clear();
  };

  return fetch;
}
