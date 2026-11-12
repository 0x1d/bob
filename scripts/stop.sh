#!/usr/bin/env bash

set -e

# @cmd: stop
# @desc: Stop services (default: model-server and opencode)

docker compose --profile opencode stop "$@"
