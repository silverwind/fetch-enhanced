"use strict";

const fetchEnhanced = require(".");
const http = require("http");
const nodeFetch = require("node-fetch");
const proxy = require("proxy");
const restana = require("restana");
const {isIPv6} = require("net");
const {promisify} = require("util");

const fetch = fetchEnhanced({fetch: nodeFetch});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeUrl(server) {
  const {address, port} = server.address();
  const hostname = isIPv6(address) ? `[${address}]` : address;
  return Object.assign(new URL("http://x"), {hostname, port}).toString().replace(/\/$/, "");
}

let testServer, testUrl;

beforeAll(async () => {
  testServer = await restana({defaultRoute: async (_req, res) => {
    await sleep(500);
    res.statusCode = 204;
    res.end();
  }});
  testServer = await testServer.start(0, "127.0.0.1");
  testUrl = makeUrl(testServer);
});

afterAll(async () => {
  if (testServer) testServer.close();
});

test("proxy", async () => {
  const proxyServer = proxy(http.createServer());
  await promisify(proxyServer.listen).bind(proxyServer)();
  const url = makeUrl(proxyServer);

  process.env.HTTP_PROXY = url;
  process.env.HTTPS_PROXY = url;
  const res = await fetch(testUrl);
  expect(res.ok).toEqual(true);
  expect(res.status).toEqual(204);

  process.env.HTTP_PROXY = "http://proxy.invalid";
  process.env.HTTPS_PROXY = "http://proxy.invalid";
  await expect(fetch(testUrl, {timeout: 100})).rejects.toThrow();
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;

  proxyServer.close();
});

test("timeout", async () => {
  await expect(fetch(testUrl, {timeout: 100})).rejects.toThrow();
  const res = await fetch(testUrl, {timeout: 1000});
  expect(res.ok).toEqual(true);
  expect(res.status).toEqual(204);
});

test("cancel", async () => {
  const promise = fetch(testUrl);
  expect(typeof promise.cancel).toEqual("function");
  promise.cancel();
  expect(await promise).toEqual(null);
});
