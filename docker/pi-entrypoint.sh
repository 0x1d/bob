#!/bin/bash
set -e

AGENT_USER="agent"
AGENT_HOME=$(getent passwd "$AGENT_USER" | cut -d: -f6)
EXT="$AGENT_HOME/.pi/agent/extensions/rtk.ts"

if [ "$(id -u)" = "0" ]; then
    # shellcheck source=/dev/null
    [ -f /usr/local/lib/pi/docker-socket-setup.sh ] && . /usr/local/lib/pi/docker-socket-setup.sh

    if [ -d /workspace ]; then
        chown -R "$AGENT_USER:$AGENT_USER" /workspace 2>/dev/null || true
    fi
    chown -R "$AGENT_USER:$AGENT_USER" "$AGENT_HOME" 2>/dev/null || true

    if command -v rtk >/dev/null 2>&1 && [ ! -f "$EXT" ]; then
        gosu "$AGENT_USER" rtk init --agent pi --global >/dev/null 2>&1 || true
    fi

    exec gosu "$AGENT_USER" pi "$@"
fi

if command -v rtk >/dev/null 2>&1 && [ ! -f "$EXT" ]; then
    mkdir -p "$(dirname "$EXT")"
    rtk init --agent pi --global >/dev/null 2>&1 || true
fi
exec pi "$@"
