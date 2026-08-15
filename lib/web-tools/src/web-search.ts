/**
 * Web search — hits two public DuckDuckGo endpoints, no headless browser.
 *
 *   1. Instant Answer API  — https://api.duckduckgo.com/
 *      Returns the Wikipedia abstract (if any) plus a tree of RelatedTopics,
 *      each with a real URL + abstract text. Best for factual queries.
 *   2. Autocomplete         — https://duckduckgo.com/ac/?q=...&type=list
 *      Returns query suggestions (no URLs). Used as a fallback when the
 *      Instant Answer API has no Abstract.
 *
 * Both endpoints are public (no API key). Neither is a SERP — DDG doesn't
 * expose one. The Instant Answer API is a side product of DDG's knowledge
 * graph, useful for research but not "10 blue links" for an open query.
 * Empirically the HTML SERP endpoint returns an "anomaly" CAPTCHA to
 * scripted clients, so we don't try it here.
 */

import type { SearchResponse, SearchResult, WebSearchOptions } from './types.js';

const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT = 'BobWebTools/0.1';

const INSTANT_ANSWER = 'https://api.duckduckgo.com/';
const AUTOCOMPLETE = 'https://duckduckgo.com/ac/';

// ---------------------------------------------------------------------------
// Instant Answer API
// ---------------------------------------------------------------------------

interface InstantAnswerResponse {
  Abstract?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Heading?: string;
  Answer?: string;
  AnswerType?: string;
  Definition?: string;
  DefinitionURL?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
    Topics?: Array<{ Text?: string; FirstURL?: string }>;
  }>;
  Results?: Array<{ Text?: string; FirstURL?: string }>;
  Redirect?: string;
}

async function fetchInstantAnswer(
  query: string,
  options: WebSearchOptions,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    skip_disambig: '1',
    t: 'BobWebTools_0.1',
  });
  if (options.region) params.set('kl', options.region);

  const url = `${INSTANT_ANSWER}?${params.toString()}`;
  const res = await fetchWithTimeout(url, { timeout: options.timeout ?? DEFAULT_TIMEOUT_MS });

  let data: InstantAnswerResponse;
  try {
    data = (await res.json()) as InstantAnswerResponse;
  } catch {
    return [];
  }

  const out: SearchResult[] = [];

  // Main abstract (Wikipedia-style summary).
  if (data.AbstractText && data.AbstractURL) {
    out.push({
      title: data.Heading || data.AbstractSource || 'Abstract',
      url: data.AbstractURL,
      snippet: data.AbstractText,
      raw: { kind: 'abstract' },
    });
  }

  // Direct answer (e.g. "speed of light", calculator queries).
  if (data.Answer && data.AnswerType && data.AnswerType !== 'none') {
    out.push({
      title: `Answer (${data.AnswerType})`,
      url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: data.Answer,
      raw: { kind: 'answer', type: data.AnswerType },
    });
  }

  // Definition (dictionary-style).
  if (data.Definition && data.DefinitionURL) {
    out.push({
      title: 'Definition',
      url: data.DefinitionURL,
      snippet: data.Definition,
      raw: { kind: 'definition' },
    });
  }

  // Top-level Results array (rare).
  for (const r of data.Results ?? []) {
    if (r.Text && r.FirstURL) {
      out.push({ title: stripPrefix(r.Text), url: r.FirstURL, snippet: r.Text, raw: { kind: 'result' } });
    }
  }

  // RelatedTopics — recursively flatten nested Topics.
  const flat = flattenRelatedTopics(data.RelatedTopics ?? []);
  for (const topic of flat) {
    if (topic.Text && topic.FirstURL) {
      const title = extractTitleFromText(topic.Text) || topic.FirstURL;
      out.push({ title, url: topic.FirstURL, snippet: topic.Text, raw: { kind: 'related' } });
    }
  }

  return out;
}

function flattenRelatedTopics(
  topics: InstantAnswerResponse['RelatedTopics'] = [],
): Array<{ Text?: string; FirstURL?: string }> {
  const out: Array<{ Text?: string; FirstURL?: string }> = [];
  for (const t of topics) {
    if (t.Text && t.FirstURL) out.push({ Text: t.Text, FirstURL: t.FirstURL });
    if (t.Topics) out.push(...flattenRelatedTopics(t.Topics));
  }
  return out;
}

function stripPrefix(text: string): string {
  // DDG prefixes results like "1. Foo - Bar". Strip leading numbering.
  return text.replace(/^\d+\.\s*/, '').trim();
}

function extractTitleFromText(text: string): string {
  // DDG format: "Title - Snippet text". First segment is usually the title.
  const dash = text.indexOf(' - ');
  if (dash > 0 && dash < 120) return text.slice(0, dash).trim();
  return text.slice(0, 80).trim();
}

// ---------------------------------------------------------------------------
// Autocomplete fallback
// ---------------------------------------------------------------------------

async function fetchAutocomplete(query: string, options: WebSearchOptions): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, type: 'list' });
  const url = `${AUTOCOMPLETE}?${params.toString()}`;
  const res = await fetchWithTimeout(url, { timeout: options.timeout ?? DEFAULT_TIMEOUT_MS });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) return [];

  const suggestions = data[1] as unknown[];
  const max = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const ddg = `https://duckduckgo.com/?q=`;
  return suggestions.slice(0, max).map((s) => {
    const text = String(s);
    return {
      title: text,
      url: ddg + encodeURIComponent(text),
      snippet: `Suggestion for "${query}"`,
      raw: { kind: 'suggestion' },
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  { timeout }: { timeout: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function appendSiteFilters(query: string, allowedDomains: string[]): string {
  if (allowedDomains.length === 0) return query;
  const limited = allowedDomains.slice(0, 5);
  const filters = limited.map((d) => `site:${d}`).join(' OR ');
  return `(${filters}) ${query}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run a web search. Returns the Instant Answer API result if non-empty, else autocomplete suggestions. */
export async function searchWeb(options: WebSearchOptions): Promise<SearchResponse> {
  const query = options.query?.trim() ?? '';
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const allowed = options.websitePolicy?.allowedDomains ?? [];

  if (!query) return { results: [], count: 0 };

  const effective = appendSiteFilters(query, allowed);

  let results: SearchResult[] = [];
  try {
    results = await fetchInstantAnswer(effective, options);
  } catch {
    // Fall through to autocomplete.
  }

  if (results.length === 0) {
    try {
      results = await fetchAutocomplete(query, options);
    } catch {
      // Give up gracefully.
    }
  }

  if (results.length > maxResults) results = results.slice(0, maxResults);
  return { results, count: results.length, query: effective };
}