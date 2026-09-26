import fetchEnhanced, {TimeoutError} from "./index.ts";
import enableDestroy from "server-destroy";
import {createServer} from "node:http";
import nodeFetch from "node-fetch";
import {fetch as undiciFetch} from "undici";
import {once} from "node:events";
import {createProxy} from "proxy";
import type {AddressInfo} from "node:net";
import type {Server} from "node:http";

function makeUrl(server: Server) {
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const connects = {proxy: 0, server: 0};
let url: string;

beforeAll(async () => {
  const server = createServer(async (_, res) => {
    await new Promise(resolve => setTimeout(resolve, 500).unref());
    res.writeHead(204).end();
  }).on("connection", () => connects.server++);
  enableDestroy(server);
  await once(server.listen(0, "127.0.0.1"), "listening");
  url = makeUrl(server);

  const proxyServer = createProxy(createServer()).on("connection", () => connects.proxy++);
  enableDestroy(proxyServer);
  await once(proxyServer.listen(), "listening");
  process.env.HTTP_PROXY = makeUrl(proxyServer);

  return () => {
    server.destroy();
    proxyServer.destroy();
  };
});

describe.each([
  {name: "node-fetch", fetchImplementation: nodeFetch, undici: false},
  {name: "undici", fetchImplementation: undiciFetch, undici: true},
])("$name", ({fetchImplementation, undici}) => {
  const fetch = fetchEnhanced(fetchImplementation, {undici});

  beforeAll(() => {
    Object.assign(connects, {proxy: 0, server: 0});
  });

  test("proxy working", async () => {
    expect(await fetch(url, {method: "HEAD"})).toMatchObject({ok: true, status: 204});
    expect(connects).toEqual({proxy: 1, server: 1});
  });

  test("timeout proxy", async () => {
    await expect(fetch(url, {method: "HEAD", timeout: 50})).rejects.toBeInstanceOf(TimeoutError);
    expect(connects).toEqual({proxy: 2, server: 2});
  });

  test("timeout no proxy", async () => {
    await expect(fetch(url, {method: "HEAD", timeout: 20, agentOpts: {noProxy: true}})).rejects.toBeInstanceOf(TimeoutError);
    expect(connects.proxy).toBeLessThan(connects.server);
  });

  test("invalid url rejects", async () => {
    await expect(fetch("invalid")).rejects.toThrow("Invalid URL");
  });

  test("undefined rejection rejects", async () => {
    await expect(fetchEnhanced(vi.fn().mockRejectedValue(undefined), {undici})(url)).rejects.toBeUndefined();
  });

  test("no timeout", async () => {
    expect(await fetch(url, {method: "HEAD", timeout: 1000, agentOpts: {noProxy: true}})).toMatchObject({ok: true, status: 204});
    expect(connects.proxy).toBeLessThan(connects.server);
  });
});
