# @bob/web-tools

Web search and page fetch (HTML → Markdown) for Bob agents.

Clean, focused implementation inspired by [@opencode-ai/web](https://github.com/anomalyco/opencode).

## Features

- **Web Search**: DuckDuckGo Instant Answer API + autocomplete fallback
- **Page Fetch**: SSRF-protected HTTP/HTTPS with HTML→Markdown conversion
- **Policy Enforcement**: Allow/block lists for registrable domains
- **Smart Truncation**: Respects `maxChars` with graceful truncation markers
- **Retry Support**: Configurable backoff retries on network failures

## Install

```sh
npm install
npm run build
```

## Usage

```ts
import { searchWeb, fetchUrl } from '@bob/web-tools';

// Search via DuckDuckGo's Instant Answer API (with autocomplete fallback).
const search = await searchWeb({
  query: 'typescript',
  maxResults: 5,
  websitePolicy: { allowedDomains: ['wikipedia.org'] },
});
//   -> { results: [{ title, url, snippet, raw }], count, query }

// Fetch a URL with SSRF protection and HTML → Markdown conversion.
const page = await fetchUrl({
  url: 'https://example.com',
  maxChars: 8000,
  convertHtmlToMarkdown: true,
});
//   -> { success, content, contentType, convertedFromHtml, url, ... }
```

## Security

`fetchUrl` blocks private / loopback / link-local IP addresses (both IPv4
and IPv6) — preventing SSRF against the host. The optional `websitePolicy`
adds an allow/block list of registrable domains.

## Testing

```sh
npm test                  # unit tests only (no network)
RUN_NETWORK_TESTS=1 npm test  # also runs live fetch + search tests
```

## Search backend

DuckDuckGo doesn't expose a public SERP. The only public DDG endpoints are
the Instant Answer API and autocomplete, both of which we hit here:

- **Instant Answer API** (`api.duckduckgo.com`) — returns the Wikipedia
  abstract for the query plus a tree of RelatedTopics with real URLs and
  snippets. Best for factual queries.
- **Autocomplete** (`duckduckgo.com/ac/`) — query suggestions, used as a
  fallback when the Instant Answer API has no Abstract.

Empirically, the HTML SERP endpoint returns an "anomaly" CAPTCHA to
scripted clients, so we don't try it. For ranked web results you'd need
either a third-party SERP API (e.g. SerpAPI) or a headless browser —
neither is in scope.
