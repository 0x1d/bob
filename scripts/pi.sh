#!/usr/bin/env bash

set -e

# @cmd: pi
# @desc: Run the Pi agent (docker run -it, CWD mounted to /workspace)

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "${HF_ROOT}/harness.sh" pi
