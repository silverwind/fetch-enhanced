import fetchEnhanced, {TimeoutError} from "./index.js";
import enableDestroy from "server-destroy";
import http from "http";
import nodeFetch from "node-fetch";
import {promisify} from "util";
import getPort from "get-port";

const fetch = fetchEnhanced(globalThis.fetch || nodeFetch);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms).unref());

function makeUrl(server) {
  const {port} = server.address();
  return String(Object.assign(new URL("http://localhost"), {port})).replace(/\/$/, "");
}

describe("timeout", () => {
  let server, url;

  beforeEach(async () => {
    server = http.createServer(async function onRequest(_, res) {
      await sleep(200);
      res.statusCode = 204;
      res.end();
    });
    enableDestroy(server);
    await promisify(server.listen).bind(server)(await getPort(), "127.0.0.1");
    url = makeUrl(server);
  });

  afterEach(async () => {
    server.destroy();
  });

  test("timeout", async () => {
    try {
      await fetch(url, {timeout: 10});
      throw new Error("No error thrown");
    } catch (err) {
      if (!(err instanceof TimeoutError)) {
        console.error(err);
      }
      expect(err).toBeInstanceOf(TimeoutError);
    }
  });

  test("no timeout", async () => {
    fetch.clearCache();
    const res = await fetch(url, {timeout: 1000});
    expect(res.ok).toEqual(true);
    expect(res.status).toEqual(204);
  });
});
