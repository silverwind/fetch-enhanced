import fetchEnhanced from "./index.js";
import enableDestroy from "server-destroy";
import http from "http";
import nodeFetch from "node-fetch";
import proxy from "proxy";
import {promisify} from "util";
import getPort from "get-port";

const fetch = fetchEnhanced(globalThis.fetch || nodeFetch);

function makeUrl(server) {
  const {port} = server.address();
  return String(Object.assign(new URL("http://localhost"), {port})).replace(/\/$/, "");
}

describe("proxy", () => {
  let server, proxyServer, url, proxyUrl, connects;

  beforeEach(async () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;

    server = http.createServer(async function onRequest(_, res) {
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

    connects = 0;
    proxyServer.on("connect", () => connects++);

    fetch.clearCache();
  });

  afterEach(async () => {
    server.destroy();
    proxyServer.destroy();
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
});
