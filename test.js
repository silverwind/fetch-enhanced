import fetchEnhanced, {TimeoutError} from "./index.js";
import enableDestroy from "server-destroy";
import http from "http";
import nodeFetch from "node-fetch";
import {promisify} from "util";
import getPort from "get-port";
import proxy from "proxy";

const fetch = fetchEnhanced(globalThis.fetch || nodeFetch);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms).unref());

function makeUrl(server) {
  const {port} = server.address();
  return String(Object.assign(new URL("http://127.0.0.1"), {port})).replace(/\/$/, "");
}

let server, proxyServer, url, proxyUrl, serverConnects, proxyConnects;

beforeAll(async () => {
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;

  server = http.createServer(async function onRequest(_, res) {
    await sleep(500);
    res.statusCode = 204;
    res.end();
  });
  enableDestroy(server);
  await promisify(server.listen).bind(server)(await getPort(), "127.0.0.1");
  url = makeUrl(server);

  proxyServer = proxy(http.createServer());
  enableDestroy(proxyServer);
  await promisify(proxyServer.listen).bind(proxyServer)();
  proxyUrl = makeUrl(proxyServer);

  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;

  serverConnects = 0;
  proxyConnects = 0;

  server.on("connection", () => {
    serverConnects++;
  });
  proxyServer.on("connection", () => {
    proxyConnects++;
  });
});

afterAll(async () => {
  server.destroy();
  proxyServer.destroy();
});

describe("serial tests", () => {
  test("proxy working", async () => {
    const res = await fetch(url);
    expect(res.ok).toEqual(true);
    expect(res.status).toEqual(204);
    expect(proxyConnects).toEqual(serverConnects);
  });

  test("timeout proxy", async () => {
    try {
      await fetch(url, {timeout: 50});
      throw new Error("No error thrown");
    } catch (err) {
      if (!(err instanceof TimeoutError)) {
        console.error(err);
      }
      expect(err).toBeInstanceOf(TimeoutError);
    }
    expect(proxyConnects).toEqual(serverConnects);
  });

  // below test works but causes jest to not exit cleanly because of open handles
  // test("proxy not existant", async () => {
  //   process.env.HTTP_PROXY = "http://192.0.2.1";
  //   process.env.HTTPS_PROXY = "http://192.0.2.1";
  //   await expect(fetch(url, {timeout: 200})).rejects.toThrow(TimeoutError);
  //   expect(proxyConnects).toEqual(serverConnects);
  // });

  test("timeout no proxy", async () => {
    try {
      await fetch(url, {timeout: 50, agentOpts: {noProxy: true}});
      throw new Error("No error thrown");
    } catch (err) {
      if (!(err instanceof TimeoutError)) {
        console.error(err);
      }
      expect(err).toBeInstanceOf(TimeoutError);
    }
    expect(proxyConnects).toBeLessThan(serverConnects);
  });

  test("no timeout", async () => {
    const res = await fetch(url, {timeout: 1000, agentOpts: {noProxy: true}});
    expect(res.ok).toEqual(true);
    expect(res.status).toEqual(204);
    expect(proxyConnects).toBeLessThan(serverConnects);
  });
});
