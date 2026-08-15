/**
 * Web fetch — pull a URL and return readable text (HTML → Markdown by default).
 *
 * Hardening:
 *  - Blocks private / loopback / link-local addresses (SSRF protection).
 *  - Enforces an optional WebsitePolicy (allowed/blocked domain lists).
 *  - Caps response body size before parsing.
 *  - Detects binary content (magic bytes + null-byte scan) and refuses it.
 *  - Manual redirect loop with re-validation on every hop.
 */

import * as net from 'node:net';
import dns from 'node:dns/promises';

interface LookupAddress {
  address: string;
  family: number;
}
import { htmlToMarkdown } from './html-parser.js';
import type { UrlFetchResult, WebFetchOptions, WebsitePolicy } from './types.js';

const MAX_FETCH_BYTES = 512 * 1024; // 512KB
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_CHARS = 8_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 500;
const MAX_REDIRECTS = 5;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; BobWebTools/0.1; +https://example.invalid)',
];

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function normalizeScheme(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  if (/^[\w-]+:\/\//i.test(input)) {
    throw new Error(`Unsupported URL scheme: ${input}`);
  }
  return `https://${input}`;
}

interface ParsedHost {
  hostname: string;
  port: number;
  isPrivate: boolean;
}

function parseUrlHost(url: string): ParsedHost | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  // URL.hostname returns bracketed IPv6 (e.g. "[::1]"); strip the brackets
  // so net.isIP and dns.lookup see a plain address.
  const raw = u.hostname;
  const hostname = raw.startsWith('[') && raw.endsWith(']')
    ? raw.slice(1, -1)
    : raw;
  if (!hostname) return null;
  const port = u.port
    ? Number.parseInt(u.port, 10)
    : u.protocol === 'https:'
      ? 443
      : 80;
  return { hostname, port, isPrivate: false };
}

/** True when an IPv4 address is in a private / loopback / link-local range. */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('ff')) return true; // multicast
  return false;
}

async function resolveAndCheck(hostname: string): Promise<{
  ok: true;
  pinnedIp: string;
} | { ok: false; error: string }> {
  // If the hostname is already an IP literal, validate it directly.
  const family = net.isIP(hostname);
  if (family === 4) {
    return isPrivateIpv4(hostname)
      ? { ok: false, error: 'Refusing to fetch private IP address' }
      : { ok: true, pinnedIp: hostname };
  }
  if (family === 6) {
    return isPrivateIpv6(hostname)
      ? { ok: false, error: 'Refusing to fetch private IP address' }
      : { ok: true, pinnedIp: hostname };
  }

  let addrs: LookupAddress[];
  try {
    addrs = await dns.lookup(hostname, { all: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `DNS resolution failed for ${hostname}: ${message}` };
  }
  if (addrs.length === 0) {
    return { ok: false, error: `No addresses for ${hostname}` };
  }
  for (const a of addrs) {
    if (a.family === 4 && isPrivateIpv4(a.address)) {
      return { ok: false, error: 'Refusing to fetch private IP address' };
    }
    if (a.family === 6 && isPrivateIpv6(a.address)) {
      return { ok: false, error: 'Refusing to fetch private IP address' };
    }
  }
  return { ok: true, pinnedIp: addrs[0]!.address };
}

// ---------------------------------------------------------------------------
// Website policy
// ---------------------------------------------------------------------------

function getRegistrableDomain(hostname: string): string {
  // Tiny "last two labels" heuristic. Good enough for policy matching — we
  // don't need full PSL for an allow/block list.
  const labels = hostname.toLowerCase().split('.');
  if (labels.length <= 2) return hostname.toLowerCase();
  const lastTwo = labels.slice(-2).join('.');
  // Heuristic: 2-letter TLD (uk, au, jp) → include the preceding label too.
  if (labels[labels.length - 1]!.length === 2 && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

function isSubdomainOrEqual(host: string, rule: string): boolean {
  const h = host.toLowerCase();
  const r = rule.toLowerCase();
  if (h === r) return true;
  return h.endsWith('.' + r);
}

function checkPolicy(
  url: string,
  policy: WebsitePolicy | undefined,
): { allowed: boolean; reason: string } {
  if (!policy) return { allowed: true, reason: '' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }
  const host = parsed.hostname.toLowerCase();
  const registrable = getRegistrableDomain(host);

  for (const blocked of policy.blockedDomains ?? []) {
    if (isSubdomainOrEqual(host, blocked) || isSubdomainOrEqual(registrable, blocked)) {
      return { allowed: false, reason: `Blocked domain: ${blocked}` };
    }
  }

  const allowed = policy.allowedDomains ?? [];
  if (allowed.length === 0) return { allowed: true, reason: '' };
  for (const a of allowed) {
    if (isSubdomainOrEqual(host, a) || isSubdomainOrEqual(registrable, a)) {
      return { allowed: true, reason: '' };
    }
  }
  return { allowed: false, reason: 'Host not in allowed domains' };
}

// ---------------------------------------------------------------------------
// Content-type sniffing
// ---------------------------------------------------------------------------

function looksLikeHtml(body: string): boolean {
  const probe = body.trimStart().slice(0, 512).toLowerCase();
  if (probe.startsWith('<!doctype html')) return true;
  return /^<\/?(html|head|body|title|meta|link|script|style|article|section|main|header|footer|nav|aside|figure|form|ul|ol|dl|pre|blockquote|div|p|h[1-6])\b/i.test(
    probe,
  );
}

function hasBinarySignature(buf: Buffer): boolean {
  if (buf.length >= 4) {
    if (buf[0] === 0xff && buf[1] === 0xd8) return true; // JPEG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return true; // ZIP / DOCX / XLSX
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true; // ELF
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return true; // PDF
  }
  // Null-byte scan over the first 8KB.
  const scan = Math.min(8192, buf.length);
  for (let i = 0; i < scan; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function normaliseCharset(raw: string, bodyBytes: Buffer): string {
  // Strip charset from the Content-Type header. Defaults to utf-8.
  const m = /charset=([\w-]+)/i.exec(raw);
  if (m) return m[1]!.toLowerCase();
  // Auto-detect: presence of BOM or non-ASCII in UTF-8 patterns suggests utf-8.
  if (bodyBytes.length >= 3 && bodyBytes[0] === 0xef && bodyBytes[1] === 0xbb && bodyBytes[2] === 0xbf) {
    return 'utf-8';
  }
  return 'utf-8';
}

function decodeBody(bodyBytes: Buffer, charset: string): string {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bodyBytes);
  } catch {
    return bodyBytes.toString('utf8');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

interface InternalFetchOpts {
  url: string;
  timeout: number;
  maxBytes: number;
  websitePolicy?: WebsitePolicy;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function fetchOnce(opts: InternalFetchOpts): Promise<UrlFetchResult> {
  let url: string;
  try {
    url = normalizeScheme(opts.url);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      url: opts.url,
    };
  }

  const host = parseUrlHost(url);
  if (!host) {
    return { success: false, error: 'Invalid URL', url };
  }

  const policy = checkPolicy(url, opts.websitePolicy);
  if (!policy.allowed) {
    return { success: false, error: policy.reason, url };
  }

  const dnsCheck = await resolveAndCheck(host.hostname);
  if (!dnsCheck.ok) {
    return { success: false, error: dnsCheck.error, url };
  }

  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
  const headers: Record<string, string> = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
    'Accept-Language': 'en-US,en;q=0.9',
    ...opts.headers,
  };

  // Combined abort signal: caller + our internal timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    let current = url;
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(current, {
        signal: controller.signal,
        headers,
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return { success: false, error: 'Redirect missing Location header', url: current };
        }
        let next: string;
        try {
          next = new URL(location, current).toString();
        } catch {
          return { success: false, error: `Bad redirect target: ${location}`, url: current };
        }

        // Re-validate the next hop.
        const nextHost = parseUrlHost(next);
        if (!nextHost) {
          return { success: false, error: 'Redirect to invalid host', url: current };
        }
        const nextDns = await resolveAndCheck(nextHost.hostname);
        if (!nextDns.ok) {
          return { success: false, error: nextDns.error, url: current };
        }
        const nextPolicy = checkPolicy(next, opts.websitePolicy);
        if (!nextPolicy.allowed) {
          return { success: false, error: nextPolicy.reason, url: current };
        }
        // Drain the redirect body to free the connection.
        try { await response.body?.cancel(); } catch { /* ignore */ }
        current = next;
        continue;
      }

      break;
    }

    if (!response) {
      return { success: false, error: 'No response received', url };
    }

    if (response.status >= 400) {
      return {
        success: false,
        error: `HTTP ${response.status} ${response.statusText}`,
        url: current,
      };
    }

    const rawContentType = response.headers.get('content-type') ?? '';
    const charset = normaliseCharset(rawContentType, Buffer.alloc(0));

    // Stream the body with a hard size cap.
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesRead += value.byteLength;
          if (bytesRead > opts.maxBytes) {
            await reader.cancel();
            return {
              success: false,
              error: `Response exceeds size limit (${opts.maxBytes} bytes)`,
              url: current,
            };
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
      }
    }

    const bodyBytes = Buffer.concat(chunks);

    if (hasBinarySignature(bodyBytes)) {
      return {
        success: false,
        unsupported: true,
        error: `Binary content (${bodyBytes.length} bytes) — not readable as text`,
        url: current,
        rawContentType,
      };
    }

    let text = decodeBody(bodyBytes, charset);

    const convertedFromHtml =
      (rawContentType.toLowerCase().includes('text/html') || looksLikeHtml(text)) &&
      /<html|<head|<body|<!doctype/i.test(text);

    if (convertedFromHtml) {
      try {
        text = htmlToMarkdown(text);
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
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        error: `Timeout after ${opts.timeout}ms`,
        url,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      url,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch a URL once. No retries. */
export async function fetchUrl(options: WebFetchOptions): Promise<UrlFetchResult> {
  if (!options.url) {
    return { success: false, error: 'Missing URL', url: '' };
  }
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

  const result = await fetchOnce({
    url: options.url,
    timeout,
    maxBytes: Math.max(MAX_FETCH_BYTES, maxChars * 4), // utf-8 worst-case ~4x
    websitePolicy: options.websitePolicy,
    headers: options.headers,
    signal: options.signal,
  });

  if (!result.success || result.content === undefined) return result;

  if (result.content.length > maxChars) {
    const total = result.content.length;
    result.content = result.content.slice(0, maxChars) +
      `\n\n... (truncated at ${maxChars} of ${total} chars)`;
  }
  return result;
}

/** Fetch with retry-on-failure. The onProgress hook fires once per attempt. */
export async function fetchUrlWithRetry(options: WebFetchOptions): Promise<UrlFetchResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoff = options.backoffDelay ?? DEFAULT_BACKOFF_MS;

  let last: UrlFetchResult | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fetchUrl(options);
    last = result;
    if (result.success) return result;
    if (attempt < maxRetries) await delay(backoff * (attempt + 1));
  }
  return last ?? { success: false, error: 'No attempts made', url: options.url };
}