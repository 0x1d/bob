#!/usr/bin/env bash

set -euo pipefail

# @cmd: opencode
# @desc: Open the OpenCode TUI attached to the running opencode server

# Attaches a terminal client to the same server that hosts the web UI, so both
# share sessions and there is only one process writing the session database.
# Runs through the image entrypoint so the client gets the server password and
# drops to the agent user.
if [ -z "$(docker compose --profile opencode ps -q --status running opencode 2>/dev/null)" ]; then
  printf 'opencode: the opencode service is not running.\n' >&2
  printf 'Start it first with:  ./ctl.sh start   (or: ./ctl.sh start --no-deps opencode)\n' >&2
  exit 1
fi

exec docker compose --profile opencode exec opencode \
  opencode-entrypoint --server http://127.0.0.1:8008 "$@"
