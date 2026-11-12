#!/usr/bin/env bash

set -e

# @cmd: generate
# @desc: Generate the model-server preset and OpenCode config from stack.yaml

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "${SCRIPTS_DIR}/bootstrap.py" generate "$@"
