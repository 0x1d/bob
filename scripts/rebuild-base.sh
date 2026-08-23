#!/usr/bin/env bash

set -e

# @cmd: rebuild-base
# @desc: Rebuild the shared bob-agent-base image

# Rebuild the shared agent base image
docker build -t bob-agent-base -f "docker/base.Dockerfile" "docker/"
