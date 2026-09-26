import fetchEnhanced, {TimeoutError} from "./index.ts";
import enableDestroy from "server-destroy";
import {createServer} from "node:http";
import nodeFetch from "node-fetch";
import {fetch as undiciFetch} from "undici";
import {once} from "node:events";
import {createProxy} from "proxy";
import type {ProxyServer} from "proxy";
import type {AddressInfo} from "node:net";
import type {Server} from "node:http";

function makeUrl(server: Server) {
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

let server: Server;
let proxyServer: ProxyServer;
let url: string;
let serverConnects = 0;
let proxyConnects = 0;

beforeAll(async () => {
  server = createServer(async (_, res) => {
    await new Promise(resolve => setTimeout(resolve, 500).unref());
    res.statusCode = 204;
    res.end();
  });
  enableDestroy(server);
  await once(server.listen(0, "127.0.0.1"), "listening");
  url = makeUrl(server);

  proxyServer = createProxy(createServer());
  enableDestroy(proxyServer);
  await once(proxyServer.listen(), "listening");
  const proxyUrl = makeUrl(proxyServer);

  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;

  server.on("connection", () => {
    serverConnects++;
  });
  proxyServer.on("connection", () => {
    proxyConnects++;
  });
});

afterAll(() => {
  server.destroy();
  proxyServer.destroy();
});

describe.each([
  {name: "node-fetch", fetchImplementation: nodeFetch, undici: false},
  {name: "undici", fetchImplementation: undiciFetch, undici: true},
])("$name", ({fetchImplementation, undici}) => {
  const fetch = fetchEnhanced(fetchImplementation, {undici});

  afterAll(() => {
    serverConnects = 0;
    proxyConnects = 0;
  });

  test("proxy working", async () => {
    const res = await fetch(url, {method: "HEAD"});
    expect(res.ok).toEqual(true);
    expect(res.status).toEqual(204);
    expect(proxyConnects).toEqual(1);
    expect(serverConnects).toEqual(1);
  });

  test("timeout proxy", async () => {
    await expect(fetch(url, {method: "HEAD", timeout: 50})).rejects.toBeInstanceOf(TimeoutError);
    expect(proxyConnects).toEqual(2);
    expect(serverConnects).toEqual(2);
  });

  test("timeout no proxy", async () => {
    await expect(fetch(url, {method: "HEAD", timeout: 20, agentOpts: {noProxy: true}})).rejects.toBeInstanceOf(TimeoutError);
    expect(proxyConnects).toBeLessThan(serverConnects);
  });

  test("invalid url rejects", async () => {
    await expect(fetch("invalid")).rejects.toThrow("Invalid URL");
  });

  test("undefined rejection rejects", async () => {
    await expect(fetchEnhanced(vi.fn().mockRejectedValue(undefined), {undici})(url)).rejects.toBeUndefined();
  });

  test("no timeout", async () => {
    const res = await fetch(url, {method: "HEAD", timeout: 1000, agentOpts: {noProxy: true}});
    expect(res.ok).toEqual(true);
    expect(res.status).toEqual(204);
    expect(proxyConnects).toBeLessThan(serverConnects);
  });
});
