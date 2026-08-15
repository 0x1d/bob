#!/usr/bin/env bash

set -euo pipefail

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="${HF_ROOT}/scripts"

##
## Bob — Self-Bootstrapping llama.cpp Deployment
##
## Usage: ./ctl.sh COMMAND [ARGS...]
## Command help is sourced from per-command headers in scripts/*.sh.

COMMAND="${1:-help}"
SCRIPT="${SCRIPTS_DIR}/${COMMAND}.sh"

if [ ! -x "${SCRIPT}" ]; then
  printf 'Unknown command: %s\n\n' "${COMMAND}" >&2
  "${SCRIPTS_DIR}/help.sh" >&2
  exit 1
fi

# Execute the capability script, replacing the current shell
exec "${SCRIPT}" "${@:2}"
