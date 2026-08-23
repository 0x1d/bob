#!/usr/bin/env bash

set -e

# @cmd: rebuild-agents
# @desc: Rebuild agent images in order (base -> pi -> opencode)

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Rebuild agent images in order: base → pi → opencode
"${HF_ROOT}/build-agents.sh"
