#!/usr/bin/env bash

set -euo pipefail

# @cmd: help
# @desc: Show available commands

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${ROOT_DIR}/scripts"

if [ ! -d "${SCRIPTS_DIR}" ]; then
  printf 'Unable to read scripts directory: %s\n' "${SCRIPTS_DIR}" >&2
  exit 1
fi

printf 'Bob - Self-Bootstrapping llama.cpp Deployment\n\n'
printf 'Usage: ./ctl.sh COMMAND [ARGS...]\n\n'

awk '
  FNR == 1 { cmd = ""; desc = "" }
  /^# @cmd: / { cmd = substr($0, 9) }
  /^# @desc: / { desc = substr($0, 10) }
  ENDFILE {
    if (cmd != "") {
      printf "%s\t%s\n", cmd, desc
    }
  }
' "${SCRIPTS_DIR}"/*.sh | sort | while IFS=$'\t' read -r cmd desc; do
  printf '%-24s %s\n' "${cmd}" "${desc}"
done
