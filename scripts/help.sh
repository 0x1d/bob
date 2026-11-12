#!/usr/bin/env bash

set -euo pipefail

# @cmd: help
# @desc: Show available commands

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

printf 'Bob - Self-Bootstrapping llama.cpp Deployment\n\n'
printf 'Usage: ./ctl.sh COMMAND [ARGS...]\n\n'

# Plain sed so this works with any awk/sed (the previous gawk-only ENDFILE
# version printed nothing on mawk/busybox).
for script in "${SCRIPTS_DIR}"/*.sh; do
  cmd="$(sed -n 's/^# @cmd: //p' "${script}" | head -n 1)"
  desc="$(sed -n 's/^# @desc: //p' "${script}" | head -n 1)"
  if [ -n "${cmd}" ]; then
    printf '%-12s %s\n' "${cmd}" "${desc}"
  fi
done | sort
