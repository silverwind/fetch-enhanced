# fetch-enhanced
[![](https://img.shields.io/npm/v/fetch-enhanced.svg?style=flat)](https://www.npmjs.org/package/fetch-enhanced) [![](https://img.shields.io/npm/dm/fetch-enhanced.svg)](https://www.npmjs.org/package/fetch-enhanced)

`fetch-enhanced` wraps a user-provided `fetch`-like module like [node-fetch](https://github.com/node-fetch/node-fetch) and adds:

- HTTP Proxy discovery from standard environment variables
- HTTP Keepalive support
- HTTP agent options support
- Request timeout support

## Usage

```bash
npm i fetch-enhanced node-fetch
```
```js
const fetch = require("fetch-enhanced")(require("node-fetch"));

process.env.HTTPS_PROXY = "https://myproxy.com";
await fetch("https://google.com", {timeout: 10000});
```

## API
### fetchEnhanced(fetchImplementation)

- fetchImplementation: *Function*`fetch`-like module that takes `(url, options)` arguments and a `agent`  option like [`node-fetch`](https://github.com/node-fetch/node-fetch)

### fetch(url, options)

- `options` *Object*
  - `timeout`: *number* Request timeout in milliseconds. Default: 0 (meaning no timeout).
  - `agent`: *http.Agent* Custom HTTP agent. When specified, proxy discovery will no longer work. Default: Custom agent.
  - `agentOpts`: *object* Node [agent options](https://nodejs.org/api/http.html#http_new_agent_options). Default: `{maxSockets: 64}`
  - Any valid `fetch` module option, like for [`node-fetch`](https://github.com/node-fetch/node-fetch#options)

### fetchEnhanced.clearCache()

Clear all internal caches. This is only neccessary when the proxy environment variables are expected to change during runtime.

© [silverwind](https://github.com/silverwind), distributed under BSD licence
