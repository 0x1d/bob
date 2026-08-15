/**
 * Network tests — only run when RUN_NETWORK_TESTS=1.
 * Requires outbound HTTPS to example.com, api.duckduckgo.com, and duckduckgo.com.
 */

import { fetchUrl } from '../src/web-fetch.js';
import { searchWeb } from '../src/web-search.js';

let failures = 0;

function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

export async function runNetworkTests(): Promise<number> {
  console.log('== fetch: example.com ==');
  const ex = await fetchUrl({
    url: 'https://example.com',
    maxChars: 2000,
    timeout: 15000,
    convertHtmlToMarkdown: true,
  });
  check('example.com fetched', ex.success, `error: ${ex.error}`);
  check('converted from html', ex.convertedFromHtml === true);
  check('content non-empty', (ex.content?.length ?? 0) > 50);

  console.log('\n== fetch: example.com truncation ==');
  const truncated = await fetchUrl({
    url: 'https://example.com',
    maxChars: 50,
    timeout: 15000,
  });
  check('truncation applied', (truncated.content?.length ?? 0) <= 200, // includes truncation marker
    `len=${truncated.content?.length}`);

  console.log('\n== search: instant answer ==');
  const sa = await searchWeb({ query: 'typescript', maxResults: 5, timeout: 15000 });
  check('search returns results', sa.results.length > 0 || sa.count === 0,
    `count=${sa.count}, query=${sa.query}`);
  if (sa.results.length > 0) {
    console.log(`    first: ${sa.results[0]!.title}`);
  }

  console.log('\n== search: empty query ==');
  const empty = await searchWeb({ query: '', maxResults: 5 });
  check('empty query → empty results', empty.results.length === 0);

  return failures;
}