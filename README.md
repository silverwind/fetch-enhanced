# fetch-enhanced
[![](https://img.shields.io/npm/v/fetch-enhanced.svg?style=flat)](https://www.npmjs.org/package/fetch-enhanced) [![](https://img.shields.io/npm/dm/fetch-enhanced.svg)](https://www.npmjs.org/package/fetch-enhanced)

`fetch-enhanced` wraps a user-provided `fetch`-like module like [node-fetch](https://github.com/node-fetch/node-fetch) and adds:

- HTTP Proxy discovery from standard environment variables
- HTTP Request Timeout support
- HTTP Keepalive enabled by default

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

- fetchImplementation: *Function* A `fetch`-like module that takes `(url, options)` and a `agent` option.

### fetch(url, options)

- `options` *Object*
  - `timeout`: *number* Request timeout in milliseconds. Default: 0 (meaning no timeout).
  - `agent`: *http.Agent* Custom HTTP agent. When specified, proxy discovery will no longer work.
  - `agentOpts`: *object* [Agent options](https://nodejs.org/api/https.html#https_new_agent_options). Default: `{maxSockets: 64, keepAlive: true}`
  - Any valid `fetch` module option, like for [`node-fetch`](https://github.com/node-fetch/node-fetch#options)

### fetchEnhanced.destroyAgents()

Destroy all active agents. This is useful when shutting down the application with active keepAlive agents which may delay the process exiting otherwise.

### fetchEnhanced.clearCaches()

Clear all internal caches and destroys all agents. This is only neccessary when the proxy environment variables are expected to change during runtime or when shutting down the application.

© [silverwind](https://github.com/silverwind), distributed under BSD licence
