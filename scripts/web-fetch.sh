#!/usr/bin/env bash

set -e

# @cmd: web-fetch
# @desc: Fetch a URL and print Markdown (HTML→MD by default)

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_TOOLS="${HF_ROOT}/lib/web-tools"

if [ ! -d "${WEB_TOOLS}" ]; then
  printf 'web-tools module not found at %s\n' "${WEB_TOOLS}" >&2
  exit 1
fi

if [ ! -f "${WEB_TOOLS}/dist/index.js" ]; then
  printf '==> building web-tools (first use)\n' >&2
  (cd "${WEB_TOOLS}" && npm install --silent && npm run build --silent) || {
    printf 'web-tools build failed; run `./ctl.sh web-tools-build` for details\n' >&2
    exit 1
  }
fi

exec node "${WEB_TOOLS}/bin/web-tools.mjs" fetch "$@"