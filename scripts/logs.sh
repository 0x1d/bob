#!/usr/bin/env bash

set -e

# @cmd: logs
# @desc: Tail model-server logs

# Tail model-server logs
docker compose logs -f model-server
