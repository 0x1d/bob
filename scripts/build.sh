#!/usr/bin/env bash

set -e

# @cmd: build
# @desc: Build the OpenCode agent image (extra args go to `docker compose build`)

docker compose --profile opencode build "$@" opencode
