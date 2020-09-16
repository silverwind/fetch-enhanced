#!/usr/bin/env node
const {getProxyForUrl} = require("proxy-from-env");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");
const AbortController = require("abort-controller");

module.exports = ({fetch}) => {
  return (url, {timeout, signal, ...opts} = {}) => {
    let controller;

    const promise = new Promise((resolve, reject) => {
      // proxy
      if (!("agent" in opts)) {
        const proxyUrl = getProxyForUrl(url);
        if (proxyUrl) {
          opts.agent = () => {
            const Agent = url.startsWith("http:") ? HttpProxyAgent : HttpsProxyAgent;
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

      // cancellation
      if (!signal) {
        controller = new AbortController();
        opts = {...opts, signal: controller.signal};
      }

      const promise = fetch(url, opts);

      promise.then((...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(...args);
      }).catch(err => {
        if (err.name === "AbortError") return resolve(null);
        if (timeoutId) clearTimeout(timeoutId);
        reject(err);
      });
    });

    if (controller) {
      promise.cancel = () => controller.abort();
    }

    return promise;
  };
};
