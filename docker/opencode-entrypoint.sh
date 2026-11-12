#!/bin/bash
# Entrypoint for the OpenCode container. Used both for the long-running
# `opencode serve` process and for `./ctl.sh opencode` (docker compose exec),
# so every opencode process sees the same server password.
set -e

AGENT_USER="agent"
AGENT_HOME=$(getent passwd "$AGENT_USER" | cut -d: -f6)
CONFIG_DIR="$AGENT_HOME/.config/opencode"
DATA_DIR="$AGENT_HOME/.local/share/opencode"
PASSWORD_FILE="$CONFIG_DIR/server-password"

if [ "$(id -u)" = "0" ]; then
    # Let agent use the host docker socket: join the group that owns it.
    if [ -S /var/run/docker.sock ]; then
        DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
        getent group "$DOCKER_GID" >/dev/null || groupadd -g "$DOCKER_GID" docker_host
        usermod -aG "$(getent group "$DOCKER_GID" | cut -d: -f1)" "$AGENT_USER"
    fi

    # Docker creates missing bind-mount sources (and their parents inside the
    # container) as root. Fix only those; /workspace is left alone — agent is
    # uid 1000, and a recursive chown there is slow and rewrites host ownership.
    mkdir -p "$CONFIG_DIR" "$DATA_DIR"
    chown "$AGENT_USER:$AGENT_USER" "$AGENT_HOME/.config" "$AGENT_HOME/.local" "$AGENT_HOME/.local/share"
    chown -R "$AGENT_USER:$AGENT_USER" "$CONFIG_DIR" "$DATA_DIR"
fi

# Server password: OPENCODE_PASSWORD from the environment wins; otherwise
# generate one once and keep it in the mounted config dir (host path:
# config/opencode/server-password) so it survives restarts and can be read by
# the user and by TUI clients attaching with `opencode --server`.
if [ -z "${OPENCODE_PASSWORD:-}" ]; then
    if [ ! -s "$PASSWORD_FILE" ]; then
        (umask 077 && head -c 24 /dev/urandom | base64 | tr -d '/+=\n' > "$PASSWORD_FILE")
        [ "$(id -u)" = "0" ] && chown "$AGENT_USER:$AGENT_USER" "$PASSWORD_FILE"
    fi
    OPENCODE_PASSWORD=$(cat "$PASSWORD_FILE")
fi
export OPENCODE_PASSWORD

if [ "$(id -u)" = "0" ]; then
    exec gosu "$AGENT_USER" opencode "$@"
fi
exec opencode "$@"
