#!/bin/bash
set -euo pipefail

# Build the shared agent base image first, then build the Pi agent service that
# extends it. The base image must exist locally before docker/pi.Dockerfile is
# built because it references it via `FROM bob-agent-base`.

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR/.."

echo "==> building shared agent base image: bob-agent-base"
docker build -t bob-agent-base -f docker/base.Dockerfile docker/

echo "==> building agent service"
docker compose build pi

echo "==> done"
