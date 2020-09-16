# fetch-enhanced
[![](https://img.shields.io/npm/v/fetch-enhanced.svg?style=flat)](https://www.npmjs.org/package/fetch-enhanced) [![](https://img.shields.io/npm/dm/fetch-enhanced.svg)](https://www.npmjs.org/package/fetch-enhanced)

`fetch-enhanced` wraps a user-provided `fetch` implementation for Node.js and adds the following features:

- HTTP proxy discovery from standard environment variables
- A `timeout` option
- A `.cancel()` method on the returned Promise

## Usage

```bash
npm i fetch-enhanced
```
```js
const fetchEnhanced = require("fetch-enhanced");
const nodeFetch = require("node-fetch");
const fetch = fetchEnhanced({fetch: nodeFetch});

// timeout
await fetch("https://google.com", {timeout: 10000});

// cancellation
const promise = fetch("https://google.com");
promise.cancel();
await promise; // returns null

// proxy from environment
process.env.HTTPS_PROXY = "https://myproxy.com";
await fetch("https://google.com");
```

## API
### fetch(url, options)

- `options` Object
  - `timeout`: request timeout in milliseconds
  - any valid `fetch` module option, like for [`node-fetch`](https://github.com/node-fetch/node-fetch#options)

Returns a Promise with a `.cancel()` method that can be called to cancel the outstanding request in which case the promise will resolve to `null`.

When the `signal` option is specified, the `.cancel` method will no longer be present.
When the `agent` option is specified, HTTP proxy will no longer be discovered.

© [silverwind](https://github.com/silverwind), distributed under BSD licence
