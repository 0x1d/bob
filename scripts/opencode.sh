#!/usr/bin/env bash

set -euo pipefail

# @cmd: opencode
# @desc: Run the OpenCode agent (docker run -it, CWD mounted to /workspace)

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="bob-opencode:latest"
ENTRYPOINT="/usr/local/bin/opencode-entrypoint"

if ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
  printf 'opencode: image %s not found locally.\n' "${IMAGE}" >&2
  printf 'Build it first with:  ./ctl.sh rebuild-agents\n' >&2
  exit 1
fi

# The image's own entrypoint is the foreground process (docker -it gives it a
# real tty). It starts as root to fix volume ownership and add agent to the
# host docker socket's GID, then drops to agent via gosu and execs the bare
# `opencode` binary with no args — the interactive TUI, not the headless
# `serve` CMD the image defaults to. The container joins the compose network
# (bob_default) so the agent can reach model-server at http://model-server:6060.
exec docker run -it --rm \
  --network bob_default \
  --gpus all --runtime nvidia \
  -v "${PWD}:/workspace" \
  -v "${HF_ROOT}/config/opencode:/home/agent/.config/opencode" \
  -v "${HF_ROOT}/config/opencode-data:/home/agent/.local/share/opencode" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e "OPENCODE_CONFIG=/home/agent/.config/opencode/opencode.json" \
  -e "OPENCODE_DATA_DIR=/home/agent/.local/share/opencode" \
  -w /workspace \
  --entrypoint "${ENTRYPOINT}" \
  "${IMAGE}"
