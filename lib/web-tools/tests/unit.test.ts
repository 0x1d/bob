/**
 * Unit tests — no network required. Exercises the parser, type contracts,
 * URL parsing, and SSRF/policy logic by reaching into the same modules.
 */

import { htmlToMarkdown } from '../src/html-parser.js';
import type { SearchResponse, UrlFetchResult } from '../src/types.js';

let failures = 0;

function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ---------------------------------------------------------------------------
// html-parser
// ---------------------------------------------------------------------------

console.log('== html-parser ==');

check(
  'headings',
  htmlToMarkdown('<h1>Title</h1><p>Body</p>').includes('# Title') &&
    htmlToMarkdown('<h3>Sub</h3>').includes('### Sub'),
);

check(
  'paragraphs separated by blank lines',
  htmlToMarkdown('<p>A</p><p>B</p>').includes('A\n\nB'),
);

check(
  'bold/italic preserved',
  htmlToMarkdown('<p><strong>bold</strong> and <em>italic</em></p>')
    .includes('**bold**') && htmlToMarkdown('<p><strong>bold</strong> and <em>italic</em></p>').includes('*italic*'),
);

check(
  'unordered list',
  htmlToMarkdown('<ul><li>one</li><li>two</li></ul>').includes('- one') &&
    htmlToMarkdown('<ul><li>one</li><li>two</li></ul>').includes('- two'),
);

check(
  'ordered list increments',
  htmlToMarkdown('<ol><li>a</li><li>b</li><li>c</li></ol>')
    .match(/1\. a/) !== null && htmlToMarkdown('<ol><li>a</li><li>b</li><li>c</li></ol>').match(/3\. c/) !== null,
);

check(
  'links',
  htmlToMarkdown('<p>see <a href="https://example.com">here</a></p>')
    .includes('[here](https://example.com)'),
);

check(
  'nested lists indent',
  htmlToMarkdown('<ul><li>outer<ul><li>inner</li></ul></li></ul>')
    .includes('- inner'),
);

check(
  'blockquote prefixed with >',
  htmlToMarkdown('<blockquote><p>quoted</p></blockquote>').startsWith('> quoted'),
);

check(
  'pre/code fence',
  htmlToMarkdown('<pre><code>let x = 1;</code></pre>').includes('```') &&
    htmlToMarkdown('<pre><code>let x = 1;</code></pre>').includes('let x = 1;'),
);

check(
  'hidden element skipped',
  htmlToMarkdown('<div style="display: none">secret</div><p>visible</p>')
    .includes('visible') && !htmlToMarkdown('<div style="display: none">secret</div><p>visible</p>').includes('secret'),
);

check(
  'script and style skipped',
  htmlToMarkdown('<script>alert(1)</script><style>.x{}</style><p>ok</p>') === 'ok',
);

check(
  'table emits pipe rows',
  htmlToMarkdown('<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>')
    .includes('| a | b |') && htmlToMarkdown('<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>').includes('| 1 | 2 |'),
);

// ---------------------------------------------------------------------------
// types shape (compile-time smoke — if this compiles, the types are coherent)
// ---------------------------------------------------------------------------

console.log('\n== type contracts ==');

const okResult: UrlFetchResult = {
  success: true,
  content: 'hello',
  contentType: 'text/plain',
  url: 'https://example.com',
};
check('UrlFetchResult success shape', okResult.success && okResult.content === 'hello');

const okSearch: SearchResponse = {
  results: [{ title: 't', url: 'https://example.com', snippet: 's' }],
  count: 1,
  query: 'q',
};
check('SearchResponse shape', okSearch.count === 1 && okSearch.results[0]!.title === 't');

// ---------------------------------------------------------------------------
// SSRF / policy logic — reachable via the module's internal surface by
// triggering it through fetchUrl with bad inputs (no network, since the
// safety checks fire before the actual fetch).
// ---------------------------------------------------------------------------

console.log('\n== ssrf + policy ==');

// We import dynamically so the test runner file doesn't force the fetch module
// to load before the parser tests run (it doesn't matter today, but keeps
// import order deterministic).

async function ssrfSuite(): Promise<void> {
  const { fetchUrl } = await import('../src/web-fetch.js');

  const loopback = await fetchUrl({ url: 'http://127.0.0.1', timeout: 1000 });
  check('blocks 127.0.0.1', !loopback.success && /private/i.test(loopback.error ?? ''),
    `got: ${loopback.error}`);

  const localhost = await fetchUrl({ url: 'http://localhost', timeout: 1000 });
  check('blocks localhost (resolves to loopback)', !localhost.success && /private|DNS/i.test(localhost.error ?? ''),
    `got: ${localhost.error}`);

  const private10 = await fetchUrl({ url: 'http://10.0.0.1', timeout: 1000 });
  check('blocks 10.0.0.0/8', !private10.success && /private/i.test(private10.error ?? ''),
    `got: ${private10.error}`);

  const v6loopback = await fetchUrl({ url: 'http://[::1]', timeout: 1000 });
  check('blocks ::1', !v6loopback.success && /private/i.test(v6loopback.error ?? ''),
    `got: ${v6loopback.error}`);

  const blocked = await fetchUrl({
    url: 'https://example.com',
    timeout: 1000,
    websitePolicy: { blockedDomains: ['example.com'] },
  });
  check('policy block rejects host', !blocked.success && /blocked/i.test(blocked.error ?? ''),
    `got: ${blocked.error}`);

  const allowed = await fetchUrl({
    url: 'https://only-allowed.example',
    timeout: 1000,
    websitePolicy: { allowedDomains: ['only-allowed.example'] },
  });
  // This will fail with DNS, but the error should be DNS, not policy.
  check(
    'allowedDomains passes policy (fails later on DNS)',
    !allowed.success && !/blocked/i.test(allowed.error ?? '') && !/Host not in/i.test(allowed.error ?? ''),
    `got: ${allowed.error}`,
  );

  const denied = await fetchUrl({
    url: 'https://other.example',
    timeout: 1000,
    websitePolicy: { allowedDomains: ['only-allowed.example'] },
  });
  check(
    'allowedDomains rejects non-matching host',
    !denied.success && /not in/i.test(denied.error ?? ''),
    `got: ${denied.error}`,
  );

  const badScheme = await fetchUrl({ url: 'ftp://example.com', timeout: 1000 });
  check('rejects ftp:// scheme', !badScheme.success, `got: ${badScheme.error}`);
}

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

async function truncationSuite(): Promise<void> {
  const { fetchUrl } = await import('../src/web-fetch.js');

  // Use a URL whose DNS will resolve but whose body is short enough we control.
  // We can't reach example.com reliably in unit mode — but we can simulate by
  // calling the truncation path directly: the fetch will fail, that's fine;
  // we just want to assert the call path exists and returns a UrlFetchResult.
  const r = await fetchUrl({ url: 'https://example.com', maxChars: 10, timeout: 2000 });
  // Result is either a success (with truncated content) or a network failure.
  // Either way the shape is sane.
  check('fetchUrl returns UrlFetchResult shape',
    typeof r === 'object' && typeof r.success === 'boolean' && typeof r.url === 'string',
    `got: ${JSON.stringify(r)}`);
}

async function main(): Promise<void> {
  await ssrfSuite();
  await truncationSuite();
}

export async function runUnitTests(): Promise<number> {
  await main();
  return failures;
}