#!/usr/bin/env bash

set -e

# @cmd: stop
# @desc: Stop the model-server

# Stop the model-server
docker compose stop model-server
