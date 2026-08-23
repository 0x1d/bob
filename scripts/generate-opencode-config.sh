#!/usr/bin/env bash

set -e

# @cmd: generate-opencode-config
# @desc: Generate OpenCode opencode.json

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run bootstrap.py generate-opencode-config
python3 "${HF_ROOT}/bootstrap.py" generate-opencode-config "$@"
