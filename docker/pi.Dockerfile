FROM bob-agent-base

# Pi terminal coding agent (https://pi.dev/docs/latest).
# The base image already provides the shared dev/research/analysis toolset;
# this layer only adds the Pi CLI, Pi-specific env vars, and the entrypoint
# wrapper that drops privileges and auto-installs the rtk extension.

RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# gh CLI stores config + auth (hosts.yml) in the mounted agent dir so it
# persists on the host at config/pi/gh (gitignored). Run `gh auth login`
# inside the container once to populate it.
ENV GH_CONFIG_DIR=/home/agent/.pi/agent/gh

COPY pi-entrypoint.sh /usr/local/bin/pi-entrypoint
RUN chmod +x /usr/local/bin/pi-entrypoint

# Entrypoint starts as root to fix volume ownership and add agent to the host
# docker socket's GID, then drops to agent via gosu before exec'ing pi.
ENTRYPOINT ["pi-entrypoint"]
