#!/usr/bin/env bash

set -e

# @cmd: status
# @desc: Report model file presence and size

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run bootstrap.py status
python3 "${HF_ROOT}/bootstrap.py" status "$@"
