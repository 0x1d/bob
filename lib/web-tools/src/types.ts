/**
 * Web Tools types — shared contracts for the @bob/web-tools module.
 * Uses minimal, focused interfaces inspired by @opencode-ai/web.
 */

export interface WebsitePolicy {
  /** If non-empty, ONLY these domains (or subdomains) may be fetched/searched. */
  allowedDomains?: string[]
  /** These domains (or subdomains) are always blocked. */
  blockedDomains?: string[]
}

export interface WebSearchOptions {
  /** Free-text query. Required when `url` is not provided. */
  query?: string
  /** Cap on returned results (default 10). */
  maxResults?: number
  /** Per-attempt timeout in ms (default 15_000). */
  timeout?: number
  /** Region code forwarded to DuckDuckGo (e.g. `us-en`, `uk-en`). */
  region?: string
  /** Safelist / blocklist applied to results. */
  websitePolicy?: WebsitePolicy
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
  /** Original raw payload from the upstream provider, if you want it. */
  raw?: unknown
}

export interface SearchResponse {
  results: SearchResult[]
  count: number
  /** Echoes the effective query (with any `site:` filters appended). */
  query?: string
}

export interface WebFetchOptions {
  /** URL to fetch. Required. */
  url: string
  /** Truncate the returned content to this many characters (default 8_000). */
  maxChars?: number
  /** Total request timeout in ms (default 30_000). */
  timeout?: number
  /** Convert HTML responses to Markdown (default true). */
  convertHtmlToMarkdown?: boolean
  /** Extra HTTP headers to send. */
  headers?: Record<string, string>
  /** Abort signal — caller-driven cancellation. */
  signal?: AbortSignal
  /** Safelist / blocklist for SSRF protection. */
  websitePolicy?: WebsitePolicy
  /** Number of retries on network errors (default 2). */
  maxRetries?: number
  /** Backoff in ms multiplied by attempt number (default 500). */
  backoffDelay?: number
}

export interface FetchOptions {
  url: string
  timeout: number
  maxBytes: number
  websitePolicy?: WebsitePolicy
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface UrlFetchResult {
  success: boolean
  error?: string
  /** Decoded text content (truncated to `maxChars` when over). */
  content?: string
  /** Effective content type (after charset normalisation). */
  contentType?: string
  /** Original `Content-Type` header from upstream. */
  rawContentType?: string
  /** Final URL after redirects. */
  url: string
  /** True when HTML→Markdown conversion was applied. */
  convertedFromHtml?: boolean
  /** True when the upstream body was binary / unsupported. */
  unsupported?: boolean
}
