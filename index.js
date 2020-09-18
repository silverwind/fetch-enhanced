#!/usr/bin/env node
const {getProxyForUrl} = require("proxy-from-env");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");

module.exports = (fetch) => {
  return (url, {timeout, ...opts} = {}) => {
    return new Promise((resolve, reject) => {
      // proxy
      if (!("agent" in opts)) {
        const proxyUrl = getProxyForUrl(url);
        if (proxyUrl) {
          opts.agent = () => {
            const Agent = url.startsWith("https:") ? HttpsProxyAgent : HttpProxyAgent;
            let {protocol, hostname, port} = new URL(proxyUrl);
            hostname = hostname.replace(/^\[/, "").replace(/\]$/, "");
            return new Agent({protocol, hostname, port});
          };
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

      fetch(url, opts).then((...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(...args);
      }).catch(err => {
        if (timeoutId) clearTimeout(timeoutId);
        if (err.name === "AbortError") return resolve(null);
        reject(err);
      });
    });
  };
};
