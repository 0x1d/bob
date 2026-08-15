/**
 * Test runner — runs every unit suite, plus the network suite only when
 * `RUN_NETWORK_TESTS=1` is set. Exits non-zero on any failure.
 */

import { runUnitTests } from './unit.test.js';
import { runNetworkTests } from './network.test.js';

async function main(): Promise<void> {
  const unitFailures = await runUnitTests();
  let networkFailures = 0;

  if (process.env['RUN_NETWORK_TESTS'] === '1') {
    console.log('\n--- network tests (RUN_NETWORK_TESTS=1) ---');
    networkFailures = await runNetworkTests();
  } else {
    console.log('\n(network tests skipped — set RUN_NETWORK_TESTS=1 to run)');
  }

  const total = unitFailures + networkFailures;
  if (total > 0) {
    console.error(`\n${total} test suite(s) failed`);
    process.exit(1);
  } else {
    console.log('\nall tests passed');
  }
}

main().catch((err) => {
  console.error('test runner crashed:', err);
  process.exit(2);
});