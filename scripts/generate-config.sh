#!/usr/bin/env bash

set -e

# @cmd: generate-config
# @desc: Generate the model-server models-preset INI

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run bootstrap.py generate-config
python3 "${HF_ROOT}/bootstrap.py" generate-config "$@"
