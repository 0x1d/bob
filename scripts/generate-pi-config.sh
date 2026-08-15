#!/usr/bin/env bash

set -e

# @cmd: generate-pi-config
# @desc: Generate Pi agent models.json/settings.json

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run bootstrap.py generate-pi-config
python3 "${HF_ROOT}/bootstrap.py" generate-pi-config "$@"
