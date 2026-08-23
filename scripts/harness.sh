#!/usr/bin/env bash

set -euo pipefail

# Private helper invoked by scripts/pi.sh and scripts/opencode.sh — NOT a
# ctl.sh command (no @cmd header, so it is hidden from ./ctl.sh help).
#
# Launches the given Bob agent image with `docker run -it`, bind-mounting the
# caller's current working directory to /workspace. The agent TUI is the
# foreground process (the image's privilege-dropping entrypoint runs it
# directly). The container joins the compose network (bob_default) so the
# agent can reach model-server at http://model-server:6060.
#
# Usage: harness.sh <pi|opencode>

HARNESS="${1:-}"
if [ "${HARNESS}" != "pi" ] && [ "${HARNESS}" != "opencode" ]; then
  printf 'harness.sh: unknown harness %q (expected "pi" or "opencode")\n' \
    "${HARNESS}" >&2
  exit 2
fi

HF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="bob-${HARNESS}:latest"

# Per-harness entrypoint (the image's privilege-dropping wrapper) and the
# extra config volumes/env it needs. These config dirs live in the Bob repo
# (HF_ROOT), not the caller's CWD — they are what wire the agent at the
# model-server, so they must always resolve against the repo root.
case "${HARNESS}" in
  pi)
    ENTRYPOINT="/usr/local/bin/pi-entrypoint"
    EXTRA_VOLS=(-v "${HF_ROOT}/config/pi:/home/agent/.pi/agent")
    EXTRA_ENV=()
    ;;
  opencode)
    ENTRYPOINT="/usr/local/bin/opencode-entrypoint"
    EXTRA_VOLS=(
      -v "${HF_ROOT}/config/opencode:/home/agent/.config/opencode"
      -v "${HF_ROOT}/config/opencode-data:/home/agent/.local/share/opencode"
    )
    EXTRA_ENV=(
      -e "OPENCODE_CONFIG=/home/agent/.config/opencode/opencode.json"
      -e "OPENCODE_DATA_DIR=/home/agent/.local/share/opencode"
    )
    ;;
esac

if ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
  printf 'harness.sh: image %s not found locally.\n' "${IMAGE}" >&2
  printf 'Build it first with:  ./ctl.sh rebuild-agents\n' >&2
  exit 1
fi

# The image's own entrypoint is the foreground process (docker -it gives it a
# real tty). It drops root → agent via gosu and execs the bare agent binary
# (pi / opencode) with no args — i.e. the interactive TUI. Overriding
# --entrypoint here (with no trailing command) is what makes the opencode
# image skip its baked-in `serve` CMD and launch the TUI instead.
exec docker run -it --rm \
  --network bob_default \
  --gpus all --runtime nvidia \
  -v "${PWD}:/workspace" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  "${EXTRA_VOLS[@]}" \
  "${EXTRA_ENV[@]}" \
  -w /workspace \
  --entrypoint "${ENTRYPOINT}" \
  "${IMAGE}"
