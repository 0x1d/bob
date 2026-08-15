#!/usr/bin/env bash

set -e

# @cmd: web-tools-build
# @desc: Install deps and build the @bob/web-tools Node module (lib/web-tools/dist/)

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_TOOLS="${HF_ROOT}/lib/web-tools"

if [ ! -d "${WEB_TOOLS}" ]; then
  printf 'web-tools module not found at %s\n' "${WEB_TOOLS}" >&2
  exit 1
fi

cd "${WEB_TOOLS}"
npm install
npm run build
printf '\nweb-tools ready at %s/dist/\n' "${WEB_TOOLS}"