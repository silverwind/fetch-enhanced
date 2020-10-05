#!/usr/bin/env node
const HttpAgent = require("agentkeepalive");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");
const {getProxyForUrl} = require("proxy-from-env");
const {HttpsAgent} = require("agentkeepalive");

const agentCache = Object.create(null);
const proxyUrlCache = Object.create(null);

const defaultAgentOpts = {
  maxSockets: 64,
  keepAlive: true,
};

function getAgentCacheKey(origin, agentOpts) {
  if (!agentOpts) return origin;
  return JSON.stringify(agentOpts); // this assumes that all agent options are primitive types
}

function getAgent(url, agentOpts) {
  const {origin, protocol} = new URL(url);
  const agentCacheKey = getAgentCacheKey(origin, agentOpts);
  if (agentCacheKey in agentCache) return agentCache[agentCacheKey];

  const proxyUrl = (origin in proxyUrlCache) || (proxyUrlCache[origin] = getProxyForUrl(url));
  if (proxyUrl) {
    const {protocol: proxyProtocol, username, password, hostname, port, pathname, search, hash} = new URL(proxyUrl);
    return agentCache[agentCacheKey] = new (protocol === "https:" ? HttpsProxyAgent : HttpProxyAgent)({
      protocol: proxyProtocol,
      hostname: hostname.replace(/^\[/, "").replace(/\]$/, ""), // ipv6 compat
      port,
      path: `${pathname}${search}${hash}`,
      auth: username && password ? `${username}:${password}` : username ? username : null,
      ...agentOpts,
    });
  } else {
    return agentCache[agentCacheKey] = new (protocol === "https:" ? HttpsAgent : HttpAgent)(agentOpts);
  }
}

module.exports = fetchImplementation => {
  return function fetch(url, {timeout = 0, agentOpts = {}, ...opts} = {}) {
    return new Promise((resolve, reject) => {
      // proxy
      if (!("agent" in opts)) {
        opts.agent = getAgent(url, {...defaultAgentOpts, ...agentOpts});
      }

      // timeout
      let timeoutId;
      if (timeout) {
        timeoutId = setTimeout(() => {
          const err = new Error(`${opts.method || "GET"} ${url} timed out`);
          err.name = "TimeoutError";
          reject(err);
        }, timeout);
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
};

module.exports.destroyAgents = () => {
  for (const [origin, agent] of Object.entries(agentCache)) {
    if ("destroy" in agent) agent.destroy();
    delete agentCache[origin];
  }
};

module.exports.clearCaches = () => {
  module.exports.destroyAgents();

  for (const origin of Object.keys(proxyUrlCache)) {
    delete proxyUrlCache[origin];
  }
};
