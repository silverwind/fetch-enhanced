#!/usr/bin/env node
const HttpAgent = require("agentkeepalive");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");
const {getProxyForUrl} = require("proxy-from-env");
const {HttpsAgent} = require("agentkeepalive");

const agentCache  = {};
const proxyUrlCache = {};

const defaultAgentOpts = {
  maxSockets: 64,
  keepAlive: true,
};

function getProxy(url) {
  const {origin, protocol} = new URL(url);
  const proxyUrl = proxyUrlCache[origin] || (proxyUrlCache[origin] = getProxyForUrl(url));
  return [origin, protocol, proxyUrl];
}

function getAgent(url, agentOpts) {
  const [origin, destProtocol, proxyUrl] = getProxy(url);
  if (agentCache[origin]) return agentCache[origin];

  if (proxyUrl) {
    const {protocol, username, password, hostname, port, pathname, search, hash} = new URL(proxyUrl);
    return agentCache[origin] = new (destProtocol === "https:" ? HttpsProxyAgent : HttpProxyAgent)({
      protocol, port,
      hostname: hostname.replace(/^\[/, "").replace(/\]$/, ""), // ipv6 compat
      path: `${pathname}${search}${hash}`,
      auth: username && password ? `${username}:${password}` : username ? username : null,
      ...agentOpts,
    });
  } else {
    return agentCache[origin] = new (destProtocol === "https:" ? HttpsAgent : HttpAgent)(agentOpts);
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
