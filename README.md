# fetch-enhanced
[![](https://img.shields.io/npm/v/fetch-enhanced.svg?style=flat)](https://www.npmjs.org/package/fetch-enhanced) [![](https://img.shields.io/npm/dm/fetch-enhanced.svg)](https://www.npmjs.org/package/fetch-enhanced)

`fetch-enhanced` wraps a user-provided `fetch` implementation like [node-fetch](https://github.com/node-fetch/node-fetch) and adds the following features:

- HTTP proxy discovery from standard environment variables
- A `timeout` option

## Usage

```bash
npm i fetch-enhanced
```
```js
const fetchEnhanced = require("fetch-enhanced");
const nodeFetch = require("node-fetch");
const fetch = fetchEnhanced(nodeFetch);

// proxy from environment
process.env.HTTPS_PROXY = "https://myproxy.com";
await fetch("https://google.com");

// timeout
await fetch("https://google.com", {timeout: 10000});

// cancellation
const promise = fetch("https://google.com");
promise.cancel();
await promise; // returns null
```

## API
### fetchEnhanced(fetchImplementation)

- fetchImplementation: *Function* any fetch implementation that supports a `agent` function option like [`node-fetch`](https://github.com/node-fetch/node-fetch)

### fetch(url, options)

- `options` *Object*
  - `timeout`: *number* request timeout in milliseconds
  - any valid `fetch` module option, like for [`node-fetch`](https://github.com/node-fetch/node-fetch#options)

When the `agent` option is specified, HTTP proxy will no longer be discovered.

© [silverwind](https://github.com/silverwind), distributed under BSD licence
