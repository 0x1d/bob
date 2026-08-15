#!/usr/bin/env bash

set -e

# @cmd: web-tools-test
# @desc: Run the web-tools unit test suite (add RUN_NETWORK_TESTS=1 for live fetch/search tests)

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_TOOLS="${HF_ROOT}/lib/web-tools"

if [ ! -d "${WEB_TOOLS}" ]; then
  printf 'web-tools module not found at %s\n' "${WEB_TOOLS}" >&2
  exit 1
fi

cd "${WEB_TOOLS}"

if [ ! -d node_modules ]; then
  npm install
fi

# Forward env (RUN_NETWORK_TESTS, …) into the test runner.
exec npm test