/**
 * @bob/web-tools — web search + page fetch (HTML→Markdown) for Bob agents.
 *
 * Clean, focused interfaces inspired by @opencode-ai/web.
 *
 * Main entry points:
 *   - {@link searchWeb}   — DuckDuckGo Instant Answer + autocomplete fallback
 *   - {@link fetchUrl}    — fetch a URL, SSRF-protected, HTML→Markdown by default
 */

export type { WebFetchOptions } from './types.js'

export type {
  SearchResponse,
  SearchResult,
  UrlFetchResult,
  WebSearchOptions,
  WebsitePolicy,
} from './types.js'

export { searchWeb } from './web-search.js'
export { fetchUrl, fetchUrlWithRetry } from './web-fetch.js'
export { htmlToMarkdown } from './html-parser.js'

export * as WebTools from './index.js'
