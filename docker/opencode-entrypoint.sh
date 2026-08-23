#!/bin/bash
set -e

AGENT_USER="agent"
AGENT_HOME=$(getent passwd "$AGENT_USER" | cut -d: -f6)

if [ "$(id -u)" = "0" ]; then
    # shellcheck source=/dev/null
    [ -f /usr/local/lib/agent/docker-socket-setup.sh ] && . /usr/local/lib/agent/docker-socket-setup.sh

    if [ -d /workspace ]; then
        chown -R "$AGENT_USER:$AGENT_USER" /workspace 2>/dev/null || true
    fi
    chown -R "$AGENT_USER:$AGENT_USER" "$AGENT_HOME" 2>/dev/null || true

    exec gosu "$AGENT_USER" opencode "$@"
fi

exec opencode "$@"
