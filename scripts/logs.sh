#!/usr/bin/env bash

set -e

# @cmd: logs
# @desc: Tail service logs (default: model-server; e.g. `logs opencode`)

if [ "$#" -eq 0 ]; then
  set -- model-server
fi
docker compose --profile opencode logs -f "$@"
