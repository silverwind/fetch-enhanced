# fetch-enhanced
[![](https://img.shields.io/npm/v/fetch-enhanced.svg?style=flat)](https://www.npmjs.org/package/fetch-enhanced) [![](https://img.shields.io/npm/dm/fetch-enhanced.svg)](https://www.npmjs.org/package/fetch-enhanced)

`fetch-enhanced` wraps a provided `fetch`-like function like [undici](https://nodejs.org/dist/latest-v18.x/docs/api/globals.html#fetch) or [node-fetch](https://github.com/node-fetch/node-fetch) and adds:

- HTTP Proxy discovery from standard environment variables
- HTTP Request Timeout support
- Accessible [agent/dispatcher](https://nodejs.org/api/https.html#https_new_agent_options) [options](https://nodejs.org/api/http.html#http_new_agent_options)

## Usage

```js
import {fetch as undiciFetch} from "undici";
import fetchEnhanced from "fetch-enhanced";

const fetch = fetchEnhanced(undiciFetch);
await fetch("https://example.com");
```

## API
### fetchEnhanced(fetchImplementation, [opts])

- fetchImplementation: *Function* A `fetch`-like module that takes `(url, opts)` and a `agent` option.
- `opts` *Object*
  - `agentCacheSize`: *number* Size of the agent cache. Default: `512`.
  - `undici`: *boolean* Whether the fetch implementation is undici. Default: `false`.

Returns: A wrapped `fetch` function.

### fetch(url, [opts])

- `opts` *Object*
  - `timeout`: *number* Request timeout in milliseconds. Default: 0 (meaning no timeout).
  - `noProxy`: *boolean* Explicitely disable any proxy server use. Default: false.
  - `agent`: *http.Agent* Custom HTTP agent. When specified, proxy discovery will no longer work.
  - `agentOpts`: *object* [Agent](https://nodejs.org/api/https.html#https_new_agent_options) or [Dispatcher](https://github.com/nodejs/undici/blob/main/docs/api/ProxyAgent.md#parameter-proxyagentoptions) [options](https://nodejs.org/api/http.html#http_new_agent_options).Default: `{maxSockets: 64, keepAlive: false}`
    - `agentOpts.noProxy`: *boolean* Do not use proxy in any case. Default: `false`.
  - Any valid `fetch` module option, like for [`node-fetch`](https://github.com/node-fetch/node-fetch#options)

### TimeoutError

Error class that can be used for `err instanceof TimeoutError`:

```js
import {TimeoutError} from "fetch-enhanced";

try {
  await fetch("https://example.com", {timeout: 0});
} catch (err) {
  console.log(err instanceof TimeoutError);
  // => true
}
```

### fetch.clearCache()

Clear the agent cache and destroys all cached agents. This is generally only neccessary when the proxy environment variables are expected to change during runtime.

```js
process.env.HTTPS_PROXY = "https://proxy1.dev";
await fetch("https://example.com");
fetch.clearCache();
process.env.HTTPS_PROXY = "https://proxy2.dev";
await fetch("https://example.com");
```

© [silverwind](https://github.com/silverwind), distributed under BSD licence
