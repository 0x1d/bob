#!/usr/bin/env node
/**
 * web-tools CLI — thin argv parser that calls into the compiled library.
 *
 * Usage:
 *   web-tools search [--query <q>] [--max <n>] [--timeout <ms>]
 *                    [--region <kl>] [--allow-domains d1,d2] [--block-domains d3]
 *                    [--json]
 *   web-tools fetch <url> [--max-chars <n>] [--timeout <ms>] [--no-md]
 *                    [--allow-domains d1,d2] [--block-domains d3]
 *                    [--raw]            # raw HTML / binary, skip conversion
 *                    [--retries <n>]    # retry on failure
 *
 * Output:
 *   - search: markdown list by default, JSON with --json
 *   - fetch:  markdown (or raw text), full diagnostics on failure
 */

import { searchWeb, fetchUrl } from '../dist/index.js';

const HELP = `web-tools — search the web and fetch pages

USAGE
  web-tools search [--query <q>] [options]
  web-tools fetch <url> [options]
  web-tools help

SEARCH OPTIONS
  -q, --query <q>          search query (required unless --query given)
      --max <n>            max results (default 10)
      --timeout <ms>       per-request timeout (default 15000)
      --region <kl>        DuckDuckGo region code (e.g. us-en, uk-en)
      --allow-domains d1,d2   whitelist of registrable domains
      --block-domains d3,d4   blocklist
      --json               emit JSON instead of markdown

FETCH OPTIONS
      --max-chars <n>      truncate output (default 8000)
      --timeout <ms>       total timeout (default 30000)
      --no-md              skip HTML→Markdown conversion
      --raw                emit raw decoded body (no markdown, no trim)
      --retries <n>        retry on failure (default 0)
      --allow-domains d1,d2
      --block-domains d3,d4

EXAMPLES
  web-tools search --query "what is typescript" --max 3
  web-tools fetch https://example.com --max-chars 2000
  web-tools fetch https://wikipedia.org/wiki/TypeScript --no-md | head
`;

// ---------------------------------------------------------------------------
// Tiny argv parser — no deps.
// ---------------------------------------------------------------------------

class Argv {
  constructor(argv) {
    this.pos = 0;
    this.argv = argv;
  }
  done() { return this.pos >= this.argv.length; }
  peek() { return this.argv[this.pos]; }
  rest() { return this.argv.slice(this.pos); }
  shift() { return this.argv[this.pos++]; }
  flag(name) {
    const a = this.argv[this.pos];
    if (a === `--${name}`) { this.pos++; return true; }
    return false;
  }
  /** Returns value for `--name <v>` or `--name=<v>`, else fallback. */
  opt(name, fallback) {
    const a = this.argv[this.pos];
    if (a === `--${name}`) {
      this.pos++;
      return this.argv[this.pos++] ?? '';
    }
    const eq = `--${name}=`;
    if (a && a.startsWith(eq)) {
      this.pos++;
      return a.slice(eq.length);
    }
    // Short alias: only -q for --query.
    if (name === 'query' && a === '-q') {
      this.pos++;
      return this.argv[this.pos++] ?? '';
    }
    return fallback;
  }
  /** Comma-split a list option. */
  optList(name, fallback = []) {
    const v = this.opt(name, null);
    if (v === null) return fallback;
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function die(msg, code = 2) {
  console.error(`web-tools: ${msg}\n`);
  console.error('Run `web-tools help` for usage.');
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdSearch(argv) {
  const query = argv.opt('query', '');
  const max = Number.parseInt(argv.opt('max', '10'), 10);
  const timeout = Number.parseInt(argv.opt('timeout', '15000'), 10);
  const region = argv.opt('region', '');
  const allow = argv.optList('allow-domains');
  const block = argv.optList('block-domains');
  const asJson = argv.flag('json');

  if (!query) die('--query is required for search');
  if (!Number.isFinite(max) || max < 1) die('--max must be a positive integer');
  if (!Number.isFinite(timeout) || timeout < 100) die('--timeout must be ≥ 100ms');

  const websitePolicy = (allow.length || block.length)
    ? { allowedDomains: allow.length ? allow : undefined, blockedDomains: block.length ? block : undefined }
    : undefined;

  const response = await searchWeb({ query, maxResults: max, timeout, region, websitePolicy });

  if (asJson) {
    console.log(JSON.stringify(response, null, 2));
    return response.count > 0 ? 0 : 1;
  }

  if (response.results.length === 0) {
    console.error(`No results for "${query}"`);
    return 1;
  }
  console.log(`## Search results for "${query}"\n`);
  for (const [i, r] of response.results.entries()) {
    console.log(`### ${i + 1}. ${r.title}`);
    console.log(`URL: ${r.url}`);
    console.log('');
    console.log(r.snippet);
    console.log('');
  }
  return 0;
}

async function cmdFetch(argv) {
  const positional = [];
  while (!argv.done() && !argv.peek().startsWith('-')) positional.push(argv.shift());
  const url = positional[0];
  if (!url) die('fetch requires a URL argument');

  const maxChars = Number.parseInt(argv.opt('max-chars', '8000'), 10);
  const timeout = Number.parseInt(argv.opt('timeout', '30000'), 10);
  const noMd = argv.flag('no-md');
  const raw = argv.flag('raw');
  const retries = Number.parseInt(argv.opt('retries', '0'), 10);
  const allow = argv.optList('allow-domains');
  const block = argv.optList('block-domains');

  const websitePolicy = (allow.length || block.length)
    ? { allowedDomains: allow.length ? allow : undefined, blockedDomains: block.length ? block : undefined }
    : undefined;

  const opts = {
    url,
    maxChars,
    timeout,
    convertHtmlToMarkdown: !(noMd || raw),
    websitePolicy,
    maxRetries: retries,
  };

  let result = retries > 0
    ? await fetchWithRetries(opts)
    : await fetchUrl(opts);

  if (!result.success) {
    console.error(`fetch failed: ${result.error}`);
    if (result.url) console.error(`  url: ${result.url}`);
    return 1;
  }

  if (raw) {
    process.stdout.write(result.content ?? '');
    if (!result.content?.endsWith('\n')) process.stdout.write('\n');
  } else {
    console.log(result.content);
  }
  return 0;
}

async function fetchWithRetries(opts) {
  const { fetchUrl } = await import('../dist/index.js');
  let last = null;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    last = await fetchUrl(opts);
    if (last.success) return last;
    if (attempt < opts.maxRetries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return last;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const argv = new Argv(process.argv.slice(2));
  const cmd = argv.shift() ?? 'help';

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return 0;
  }

  if (cmd === 'search') return cmdSearch(argv);
  if (cmd === 'fetch') return cmdFetch(argv);

  die(`unknown subcommand: ${cmd}`);
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(err instanceof Error ? err.stack : String(err));
    process.exit(3);
  },
);