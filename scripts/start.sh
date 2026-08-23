#!/usr/bin/env bash

set -e

# @cmd: start
# @desc: Start model-server

# Start model-server. The Pi agent is interactive — launch it with `./ctl.sh pi`.
docker compose up -d model-server
