import fetchEnhanced, {TimeoutError} from "./index.js";
import enableDestroy from "server-destroy";
import http from "http";
import nodeFetch from "node-fetch";
import proxy from "proxy";
import {promisify} from "util";

const fetch = fetchEnhanced(globalThis.fetch || nodeFetch);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms).unref());

function makeUrl(server) {
  const {port} = server.address();
  return String(Object.assign(new URL("http://localhost"), {port})).replace(/\/$/, "");
}

async function onRequest(_req, res) {
  await sleep(500);
  res.statusCode = 204;
  res.end();
}

let server, proxyServer, url, proxyUrl, connects;

beforeEach(async () => {
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;

  server = http.createServer(onRequest);
  enableDestroy(server);
  await promisify(server.listen).bind(server)(0, "127.0.0.1");
  url = makeUrl(server);

  proxyServer = proxy(http.createServer());
  enableDestroy(proxyServer);
  await promisify(proxyServer.listen).bind(proxyServer)();
  proxyUrl = makeUrl(proxyServer);

  connects = 0;
  proxyServer.on("connect", () => connects++);
});

afterEach(async () => {
  server.destroy();
  proxyServer.destroy();
  fetch.clearCache();
});

test("proxy working", async () => {
  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  const res = await fetch(url);
  expect(res.ok).toEqual(true);
  expect(res.status).toEqual(204);
  expect(connects).toEqual(1);
});

// below test works but causes "Jest did not exit one second after the test run has completed" with traces pointing inside undici internals, disable it because of that.

// test("proxy different", async () => {
//   process.env.HTTP_PROXY = "http://192.0.2.1";
//   process.env.HTTPS_PROXY = "http://192.0.2.1";
//   await expect(fetch(url, {timeout: 100})).rejects.toThrow(TimeoutError);
//   expect(connects).toEqual(0);
// });

test("timeout", async () => {
  try {
    await fetch(url, {timeout: 10});
    throw new Error("No error thrown");
  } catch (err) {
    console.error(err);
    expect(err).toBeInstanceOf(TimeoutError);
  }
  expect(connects).toEqual(0);
});

test("no timeout", async () => {
  const res = await fetch(url, {timeout: 1000});
  expect(res.ok).toEqual(true);
  expect(res.status).toEqual(204);
});
