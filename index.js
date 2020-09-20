#!/usr/bin/env node
const HttpAgent = require("agentkeepalive");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");
const {getProxyForUrl} = require("proxy-from-env");
const {HttpsAgent} = require("agentkeepalive");

const agentCache = {};

const defaultAgentOpts = {
  maxSockets: 64,
};

function getAgent(url, agentOpts) {
  const proxyUrl = getProxyForUrl(url);
  const first5 = url.substring(0, 5);
  const isHTTPS = first5 === "https";

  if (proxyUrl) {
    let {origin, protocol, username, password, hostname, port, pathname, search, hash} = new URL(proxyUrl);
    if (agentCache[origin]) return agentCache[origin];
    hostname = hostname.replace(/^\[/, "").replace(/\]$/, ""); // ipv6 compat
    const agent = new (isHTTPS ? HttpsProxyAgent : HttpProxyAgent)({
      protocol,
      host: hostname,
      path: `${pathname}${search}${hash}`,
      auth: username && password ? `${username}:${password}` : username ? username : null,
      port,
      ...agentOpts,
    });
    return agentCache[origin] = agent;
  } else {
    if (agentCache[first5]) return agentCache[first5];
    const agent = new (isHTTPS ? HttpsAgent : HttpAgent)({...agentOpts});
    return agentCache[first5] = agent;
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

module.exports.clearAgentCache = () => {
  for (const origin of Object.keys(agentCache)) {
    delete agentCache[origin];
  }
};
