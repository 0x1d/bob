#!/usr/bin/env bash

set -e

# @cmd: start
# @desc: Start the model-server (and opencode if its service is defined)

# Start model-server. The `opencode` agent service only exists once the
# agent-image work (docker/opencode.Dockerfile etc.) lands — guarded here
# so `start` works regardless of which branch you're on.
docker compose up -d model-server

if docker compose config --services 2>/dev/null | grep -qx opencode; then
  docker compose --profile opencode up -d opencode
fi