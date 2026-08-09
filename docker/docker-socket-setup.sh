#!/bin/bash
# Add the agent user to the group that owns /var/run/docker.sock.
# No-op when not root, socket missing, or agent user absent.
if [ -S /var/run/docker.sock ] && [ "$(id -u)" = "0" ] && id agent >/dev/null 2>&1; then
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
    if ! getent group "$DOCKER_GID" >/dev/null; then
        groupadd -g "$DOCKER_GID" docker_host
    fi
    DOCKER_GROUP=$(getent group "$DOCKER_GID" | cut -d: -f1)
    usermod -aG "$DOCKER_GROUP" agent
fi
