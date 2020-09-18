#!/usr/bin/env node
const {getProxyForUrl} = require("proxy-from-env");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");

const agentCache = {};

const agents = {
  "https": HttpsProxyAgent,
  "http": HttpProxyAgent,
};

module.exports = fetch => {
  return (url, {timeout, ...opts} = {}) => {
    return new Promise((resolve, reject) => {
      // proxy
      if (!("agent" in opts)) {
        const proxyUrl = getProxyForUrl(url);
        if (proxyUrl) {
          let {origin, protocol, hostname, port} = new URL(proxyUrl);
          if (agentCache[origin]) opts.agent = agentCache[origin];

          const Agent = agents[protocol];
          if (Agent) {
            hostname = hostname.replace(/^\[/, "").replace(/\]$/, ""); // ipv6 compat
            opts.agent = new Agent({protocol, hostname, port});
          }
        }
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
