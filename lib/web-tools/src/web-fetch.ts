import { htmlToMarkdown } from './html-parser.js'
import { resolveAndCheck } from './ssrf.js'
import type { UrlFetchResult, WebsitePolicy, WebFetchOptions } from './types.js'

const MAX_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_CHARS = 8_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_BACKOFF_MS = 500
const MAX_REDIRECTS = 5

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; BobWebTools/0.1; +https://example.invalid)',
]

interface FetchOptions {
  url: string
  timeout: number
  maxBytes: number
  websitePolicy?: WebsitePolicy
  headers?: Record<string, string>
  signal?: AbortSignal
}

interface ParsedHost {
  hostname: string
  port: number
  isPrivate: boolean
}

function parseUrlHost(url: string): ParsedHost | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const raw = u.hostname
  const hostname = raw.startsWith('[') && raw.endsWith(']')
    ? raw.slice(1, -1)
    : raw
  if (!hostname) return null
  const port = u.port
    ? Number.parseInt(u.port, 10)
    : u.protocol === 'https:'
      ? 443
      : 80
  return { hostname, port, isPrivate: false }
}

function checkPolicy(
  url: string,
  policy: WebsitePolicy | undefined,
): { allowed: boolean; reason: string } {
  if (!policy) return { allowed: true, reason: '' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { allowed: false, reason: 'Invalid URL' }
  }
  const host = parsed.hostname.toLowerCase()
  const registrable = getRegistrableDomain(host)

  for (const blocked of policy.blockedDomains ?? []) {
    if (isSubdomainOrEqual(host, blocked) || isSubdomainOrEqual(registrable, blocked)) {
      return { allowed: false, reason: `Blocked domain: ${blocked}` }
    }
  }

  const allowed = policy.allowedDomains ?? []
  if (allowed.length === 0) return { allowed: true, reason: '' }
  for (const a of allowed) {
    if (isSubdomainOrEqual(host, a) || isSubdomainOrEqual(registrable, a)) {
      return { allowed: true, reason: '' }
    }
  }
  return { allowed: false, reason: 'Host not in allowed domains' }
}

function getRegistrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split('.')
  if (labels.length <= 2) return hostname.toLowerCase()
  const lastTwo = labels.slice(-2).join('.')
  if (labels[labels.length - 1]!.length === 2 && labels.length >= 3) {
    return labels.slice(-3).join('.')
  }
  return lastTwo
}

function isSubdomainOrEqual(host: string, rule: string): boolean {
  const h = host.toLowerCase()
  const r = rule.toLowerCase()
  if (h === r) return true
  return h.endsWith('.' + r)
}

async function fetchOnce(opts: FetchOptions): Promise<UrlFetchResult>
{
  let url: string
  try {
    url = normalizeScheme(opts.url)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      url: opts.url,
    }
  }

  const host = parseUrlHost(url)
  if (!host) {
    return { success: false, error: 'Invalid URL', url }
  }

  const policy = checkPolicy(url, opts.websitePolicy)
  if (!policy.allowed) {
    return { success: false, error: policy.reason, url }
  }

  const dnsCheck = await resolveAndCheck(host.hostname)
  if (!dnsCheck.ok) {
    return { success: false, error: dnsCheck.error, url }
  }

  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!
  const headers: Record<string, string> = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
    'Accept-Language': 'en-US,en;q=0.9',
    ...opts.headers,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeout)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    let current = url
    let response: Response | null = null
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(current, {
        signal: controller.signal,
        headers,
        redirect: 'manual',
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) {
          return { success: false, error: 'Redirect missing Location header', url: current }
        }
        let next: string
        try {
          next = new URL(location, current).toString()
        } catch {
          return { success: false, error: `Bad redirect target: ${location}`, url: current }
        }

        const nextHost = parseUrlHost(next)
        if (!nextHost) {
          return { success: false, error: 'Redirect to invalid host', url: current }
        }
        const nextDns = await resolveAndCheck(nextHost.hostname)
        if (!nextDns.ok) {
          return { success: false, error: nextDns.error, url: current }
        }
        const nextPolicy = checkPolicy(next, opts.websitePolicy)
        if (!nextPolicy.allowed) {
          return { success: false, error: nextPolicy.reason, url: current }
        }
        try { await response.body?.cancel() } catch { /* ignore */ }
        current = next
        continue
      }

      break
    }

    if (!response) {
      return { success: false, error: 'No response received', url }
    }

    if (response.status >= 400) {
      return {
        success: false,
        error: `HTTP ${response.status} ${response.statusText}`,
        url: current,
      }
    }

    const rawContentType = response.headers.get('content-type') ?? ''
    const charset = normaliseCharset(rawContentType, Buffer.alloc(0))

    const chunks: Buffer[] = []
    let bytesRead = 0
    if (response.body) {
      const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytesRead += value.byteLength
          if (bytesRead > opts.maxBytes) {
            await reader.cancel()
            return {
              success: false,
              error: `Response exceeds size limit (${opts.maxBytes} bytes)`,
              url: current,
            }
          }
          chunks.push(Buffer.from(value))
        }
      } finally {
        try { reader.releaseLock() } catch { /* ignore */ }
      }
    }

    const bodyBytes = Buffer.concat(chunks)

    if (hasBinarySignature(bodyBytes)) {
      return {
        success: false,
        unsupported: true,
        error: `Binary content (${bodyBytes.length} bytes) — not readable as text`,
        url: current,
        rawContentType,
      }
    }

    let text = decodeBody(bodyBytes, charset)

    const convertedFromHtml =
      (rawContentType.toLowerCase().includes('text/html') || looksLikeHtml(text)) &&
      /<html|<head|<body|<!doctype/i.test(text)

    if (convertedFromHtml) {
      try {
        text = htmlToMarkdown(text)
      } catch (err) {
        // Conversion failed — fall back to the raw decoded text.
      }
    }

    return {
      success: true,
      content: text.trim(),
      contentType: rawContentType || 'text/html; charset=utf-8',
      rawContentType,
      url: current,
      convertedFromHtml,
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        error: `Timeout after ${opts.timeout}ms`,
        url,
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      url,
    }
  } finally {
    clearTimeout(timer)
  }
}

function normalizeScheme(input: string): string {
  if (/^https?:\/\//i.test(input)) return input
  if (/^[\w-]+:\/\//i.test(input)) {
    return `https://${input}`
  }
  return input
}

function looksLikeHtml(body: string): boolean {
  const probe = body.trimStart().slice(0, 512).toLowerCase()
  if (probe.startsWith('<!doctype html')) return true
  return /^<\/(html|head|body|title|meta|link|script|style|article|section|main|header|footer|nav|aside|figure|form|ul|ol|dl|pre|blockquote|div|p|h[1-6])\b/i.test(
    probe,
  )
}

function hasBinarySignature(buf: Buffer): boolean {
  if (buf.length >= 4) {
    if (buf[0] === 0xff && buf[1] === 0xd8) return true
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true
    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return true
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return true
  }
  const scan = Math.min(8192, buf.length)
  for (let i = 0; i < scan; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

function normaliseCharset(raw: string, bodyBytes: Buffer): string {
  const m = /charset=([\w-]+)/i.exec(raw)
  if (m) return m[1]!.toLowerCase()
  if (bodyBytes.length >= 3 && bodyBytes[0] === 0xef && bodyBytes[1] === 0xbb && bodyBytes[2] === 0xbf) {
    return 'utf-8'
  }
  return 'utf-8'
}

function decodeBody(bodyBytes: Buffer, charset: string): string {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bodyBytes)
  } catch {
    return bodyBytes.toString('utf8')
  }
}

/** Fetch a URL once. No retries. */
export async function fetchUrl(options: WebFetchOptions): Promise<UrlFetchResult>
{
  if (!options.url) {
    return { success: false, error: 'Missing URL', url: '' }
  }
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS

  const result = await fetchOnce({
    url: normalizeScheme(options.url),
    timeout,
    maxBytes: Math.max(MAX_BYTES, maxChars * 4),
    websitePolicy: options.websitePolicy,
    headers: options.headers,
    signal: options.signal,
  })

  if (!result.success || result.content === undefined) return result

  if (result.content.length > maxChars) {
    const total = result.content.length
    result.content = result.content.slice(0, maxChars) +
      `\n\n... (truncated at ${maxChars} of ${total} chars)`
  }
  return result
}

/** Fetch with retry-on-failure. */
export async function fetchUrlWithRetry(options: WebFetchOptions): Promise<UrlFetchResult>
{
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const backoff = options.backoffDelay ?? DEFAULT_BACKOFF_MS

  let last: UrlFetchResult | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fetchUrl(options)
    last = result
    if (result.success) return result
    if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, backoff * (attempt + 1)))
  }
  return last ?? { success: false, error: 'No attempts made', url: options.url }
}
