"use strict";

const fetchEnhanced = require(".");
const http = require("http");
const nodeFetch = require("node-fetch");
const proxy = require("proxy");
const {isIPv6} = require("net");
const {promisify} = require("util");

const fetch = fetchEnhanced(nodeFetch);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeUrl(server) {
  const {address, port} = server.address();
  const hostname = isIPv6(address) ? `[${address}]` : address; // ipv6 compat
  return String(Object.assign(new URL("http://x"), {hostname, port})).replace(/\/$/, "");
}

let testServer, testUrl;

async function onRequest(_req, res) {
  await sleep(500);
  res.statusCode = 204;
  res.end();
}

beforeAll(async () => {
  testServer = http.createServer(onRequest);
  await promisify(testServer.listen).bind(testServer)(0, "127.0.0.1");
  testUrl = makeUrl(testServer);
});

afterAll(async () => {
  if (testServer) testServer.close();
});

afterEach(() => {
  fetchEnhanced.clearCaches();
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
  await expect(fetch(testUrl, {timeout: 100})).rejects.toThrow(fetchEnhanced.TimeoutError);
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;

  proxyServer.close();
});

test("timeout", async () => {
  await expect(fetch(testUrl, {timeout: 100})).rejects.toThrow(fetchEnhanced.TimeoutError);
  const res = await fetch(testUrl, {timeout: 1000});
  expect(res.ok).toEqual(true);
  expect(res.status).toEqual(204);
});
