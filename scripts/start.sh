#!/usr/bin/env bash

set -e

# @cmd: start
# @desc: Start model-server and opencode

# Start model-server and opencode agent.
docker compose --profile opencode up -d model-server opencode
