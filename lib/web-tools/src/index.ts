/**
 * @bob/web-tools — web search + page fetch (HTML→Markdown) for Bob agents.
 *
 * Two main entry points:
 *   - {@link searchWeb}   — DuckDuckGo Instant Answer + autocomplete fallback
 *   - {@link fetchUrl}    — fetch a URL, SSRF-protected, HTML→Markdown by default
 *
 * No third-party dependencies; everything uses Node's built-in `fetch` and `dns`.
 */

export type {
  SearchResponse,
  SearchResult,
  UrlFetchResult,
  WebFetchOptions,
  WebSearchOptions,
  WebsitePolicy,
} from './types.js';

export { searchWeb } from './web-search.js';
export { fetchUrl, fetchUrlWithRetry } from './web-fetch.js';
export { htmlToMarkdown } from './html-parser.js';