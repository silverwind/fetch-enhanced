#!/usr/bin/env node
const HttpAgent = require("agentkeepalive");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");
const {getProxyForUrl} = require("proxy-from-env");
const {HttpsAgent} = require("agentkeepalive");

const agentCache = {};
const proxyCache = {};

const defaultAgentOpts = {
  maxSockets: 64,
};

function getProxy(url) {
  const {origin} = new URL(url);
  return proxyCache[origin] || (proxyCache[origin] = getProxyForUrl(url));
}

function getAgent(url, agentOpts) {
  const proxyUrl = getProxy(url);
  const first5 = url.substring(0, 5);
  const isHTTPS = first5 === "https";

  if (proxyUrl) {
    const {origin, protocol, username, password, hostname, port, pathname, search, hash} = new URL(proxyUrl);
    return agentCache[origin] || (agentCache[origin] = new (isHTTPS ? HttpsProxyAgent : HttpProxyAgent)({
      protocol, port,
      hostname: hostname.replace(/^\[/, "").replace(/\]$/, ""), // ipv6 compat
      path: `${pathname}${search}${hash}`,
      auth: username && password ? `${username}:${password}` : username ? username : null,
      ...agentOpts,
    }));
  } else {
    return agentCache[first5] || (agentCache[first5] = new (isHTTPS ? HttpsAgent : HttpAgent)(agentOpts));
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

module.exports.clearCache = () => {
  for (const key of Object.keys(agentCache)) delete agentCache[key];
  for (const key of Object.keys(proxyCache)) delete proxyCache[key];
};
