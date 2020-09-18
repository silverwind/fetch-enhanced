# fetch-enhanced
[![](https://img.shields.io/npm/v/fetch-enhanced.svg?style=flat)](https://www.npmjs.org/package/fetch-enhanced) [![](https://img.shields.io/npm/dm/fetch-enhanced.svg)](https://www.npmjs.org/package/fetch-enhanced)

`fetch-enhanced` wraps a user-provided `fetch` implementation like [node-fetch](https://github.com/node-fetch/node-fetch) and adds the following features:

- HTTP proxy discovery from standard environment variables
- HTTP Keepalive support
- `timeout` and `agentOpts` options

Any `fetch`-like module that takes `(url, options)` arguments and a `agent` option should work, even `got`.

## Usage

```bash
npm i fetch-enhanced node-fetch
```
```js
const fetchEnhanced = require("fetch-enhanced");
const nodeFetch = require("node-fetch");
const fetch = fetchEnhanced(nodeFetch);

process.env.HTTPS_PROXY = "https://myproxy.com";
await fetch("https://google.com", {timeout: 10000});
```

## API
### fetchEnhanced(fetchImplementation)

- fetchImplementation: *Function* any fetch implementation that supports a `agent` option like [`node-fetch`](https://github.com/node-fetch/node-fetch)

### fetch(url, options)

- `options` *Object*
  - `timeout`: *number* request timeout in milliseconds. Default: none.
  - `agentOpts`: *object* node [agent options](https://nodejs.org/api/http.html#http_new_agent_options). Default: {maxSockets: 64}
  - any valid `fetch` module option, like for [`node-fetch`](https://github.com/node-fetch/node-fetch#options)

When the `agent` option is specified, HTTP proxies will no longer be discovered. The HTTP agent used for proxy requests will be cached on a per-origin basis. If the proxy environment variables may change at runtime, use `fetchEnhanced.clearAgentCache()` to clear that cache.

© [silverwind](https://github.com/silverwind), distributed under BSD licence
