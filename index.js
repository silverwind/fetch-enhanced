#!/usr/bin/env node
const {getProxyForUrl} = require("proxy-from-env");
const HttpAgent = require("agentkeepalive");
const {HttpsAgent} = require("agentkeepalive");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");

const agentCache = {};

function getAgent(url, agentOpts) {
  const proxyUrl = getProxyForUrl(url);
  if (proxyUrl) {
    let {origin, protocol, hostname, port} = new URL(proxyUrl);
    if (agentCache[origin]) return agentCache[origin];
    hostname = hostname.replace(/^\[/, "").replace(/\]$/, ""); // ipv6 compat
    const Agent = protocol === "https:" ? HttpsProxyAgent : HttpProxyAgent;
    const agent = new Agent({protocol, hostname, port, ...agentOpts});
    return agentCache[origin] = agent;
  } else {
    const {protocol} = new URL(url);
    if (agentCache[protocol]) return agentCache[protocol];
    const Agent = protocol === "https:" ? HttpsAgent : HttpAgent;
    const agent = new Agent({...agentOpts});
    return agentCache[protocol] = agent;
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
