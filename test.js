"use strict";

const fetchEnhanced = require(".");
const http = require("http");
const nodeFetch = require("node-fetch");
const proxy = require("proxy");
const {promisify} = require("util");

const fetch = fetchEnhanced(nodeFetch);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeUrl(server) {
  const {port} = server.address();
  return String(Object.assign(new URL("http://localhost"), {port})).replace(/\/$/, "");
}

let server, url;

async function onRequest(_req, res) {
  await sleep(500);
  res.statusCode = 204;
  res.end();
}

beforeAll(async () => {
  server = http.createServer(onRequest);
  await promisify(server.listen).bind(server)(0, "127.0.0.1");
  url = makeUrl(server);
});

afterAll(async () => {
  if (server) server.close();
});

afterEach(() => {
  fetch.clearCache();
});

test("proxy", async () => {
  const proxyServer = proxy(http.createServer());
  await promisify(proxyServer.listen).bind(proxyServer)();
  const proxyUrl = makeUrl(proxyServer);

  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  const res = await fetch(url);
  expect(res.ok).toEqual(true);
  expect(res.status).toEqual(204);

  process.env.HTTP_PROXY = "http://192.0.2.1";
  process.env.HTTPS_PROXY = "http://192.0.2.1";
  await expect(fetch(url, {timeout: 100})).rejects.toThrow(fetchEnhanced.TimeoutError);
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;

  proxyServer.close();
});

test("timeout", async () => {
  await expect(fetch(url, {timeout: 100})).rejects.toThrow(fetchEnhanced.TimeoutError);
  const res = await fetch(url, {timeout: 1000});
  expect(res.ok).toEqual(true);
  expect(res.status).toEqual(204);
});
