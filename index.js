#!/usr/bin/env node
const {getProxyForUrl} = require("proxy-from-env");
const HttpAgent = require("agentkeepalive");
const {HttpsAgent} = require("agentkeepalive");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");

const agentCache = {};

function getAgent(url, agentOpts) {
  const proxyUrl = getProxyForUrl(url);
  const {protocol: urlProtocol} = new URL(url);

  if (proxyUrl) {
    let {origin, protocol, username, password, hostname, port, pathname, search, hash} = new URL(proxyUrl);
    if (agentCache[origin]) return agentCache[origin];
    hostname = hostname.replace(/^\[/, "").replace(/\]$/, ""); // ipv6 compat
    const Agent = urlProtocol === "https:" ? HttpsProxyAgent : HttpProxyAgent;
    const agent = new Agent({
      protocol,
      host: hostname,
      path: `${pathname}${search}${hash}`,
      auth: username && password ? `${username}:${password}` : username ? username : null,
      port,
      ...agentOpts
    });
    return agentCache[origin] = agent;
  } else {
    if (agentCache[urlProtocol]) return agentCache[urlProtocol];
    const Agent = urlProtocol === "https:" ? HttpsAgent : HttpAgent;
    const agent = new Agent({...agentOpts});
    return agentCache[urlProtocol] = agent;
  }
}

module.exports = fetch => {
  return (url, {timeout, maxSockets = 64, ...opts} = {}) => {
    return new Promise((resolve, reject) => {
      // proxy
      if (!("agent" in opts)) {
        opts.agent = getAgent(url, {maxSockets});
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

      fetch(url, opts).then(res => {
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
