#!/usr/bin/env bash

set -e

# @cmd: download
# @desc: Fetch missing model files from Hugging Face

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run bootstrap.py download
python3 "${HF_ROOT}/bootstrap.py" download "$@"
