FROM node:24-trixie-slim

# Bob agent image: OpenCode 2 (https://opencode.ai) on Node 24 / Debian 13
# (trixie) plus a deliberately small set of general-purpose utilities.
#
# Why not ghcr.io/anomalyco/opencode? The official image is bare Alpine running
# as root with only ripgrep — no git, bash or curl — and would write root-owned
# files into the bind-mounted workspace.
#
# Heavyweight tooling (compilers, kubectl, terraform, ansible, database
# clients, ...) is intentionally NOT installed; add it in a derived image if a
# project needs it.
#   * version control:    git, gh (GitHub CLI)
#   * editors / pagers:   vim-tiny (aliased to vim), less
#   * text / data:        ripgrep, fd-find, fzf, jq, xmlstarlet, bc, file, tree
#   * archive / sync:     curl, wget, ca-certificates, rsync, zip, unzip, tar
#   * shells / multiplex: tmux, bash-completion
#   * monitoring:         htop, procps (ps/pgrep/top), lsof
#   * networking:         dnsutils (dig/host/nslookup), iproute2 (ip/ss),
#                         netcat-openbsd, openssh-client,
#                         bsdmainutils (column/hexdump)
#   * scripting / glue:   python3, python3-pip, python3-venv, python3-yaml
#                         (ctl.sh / bootstrap.py), gawk, sed
#   * privilege drop:     gosu (entrypoint runs as root, drops to agent)
#   * apt key handling:   gnupg (docker apt repo below)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git gh \
      vim-tiny less \
      ripgrep fd-find fzf jq xmlstarlet bc file tree \
      curl wget ca-certificates rsync zip unzip tar \
      tmux bash-completion \
      htop procps lsof \
      dnsutils iproute2 netcat-openbsd \
      openssh-client bsdmainutils \
      python3 python3-pip python3-venv python3-yaml gawk \
      gosu gnupg \
    && ln -s /usr/bin/fdfind /usr/local/bin/fd \
    && ln -s /usr/bin/vim.tiny /usr/local/bin/vim \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI (client + buildx + compose plugins). The compose service mounts
# the host docker socket so the agent can run ./ctl.sh (docker compose) against
# the host daemon from inside the container.
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/* \
    && docker --version

# OpenCode 2 ships as @opencode/cli (the old `opencode-ai` package is 1.x only).
# Its postinstall script selects the native binary, so scripts must stay enabled.
# Bump OPENCODE_VERSION to upgrade: https://github.com/anomalyco/opencode/releases
ARG OPENCODE_VERSION=2.2.7
RUN npm install -g "@opencode/cli@${OPENCODE_VERSION}" \
    && opencode --version

# tmux config so modified keys (Shift+Enter, Ctrl+Enter, Alt+Enter) survive
# inside a tmux session. Requires tmux >= 3.5 (trixie ships 3.5a).
RUN printf 'set -g extended-keys on\nset -g extended-keys-format csi-u\n' \
      > /etc/tmux.conf

# Runtime user: non-root `agent` (uid:gid 1000:1000), so files written into
# mounted host dirs are owned by the usual first host user instead of root.
# The node image already has a `node` user at 1000:1000; rename it.
RUN groupmod -n agent node \
    && usermod -l agent -d /home/agent -m node \
    && ln -sf /etc/tmux.conf /home/agent/.tmux.conf \
    && chown -h agent:agent /home/agent/.tmux.conf \
    && mkdir -p /workspace && chown agent:agent /workspace

WORKDIR /workspace

ENV HOME=/home/agent \
    EDITOR=vim \
    VISUAL=vim \
    PAGER=less \
    LESS=FRX \
    GIT_TERMINAL_PROMPT=0

COPY opencode-entrypoint.sh /usr/local/bin/opencode-entrypoint
RUN chmod +x /usr/local/bin/opencode-entrypoint

# `opencode serve` runs the API + web UI server in the foreground.
EXPOSE 8008

# The entrypoint starts as root (docker socket group, mount ownership, server
# password), then drops to agent via gosu before exec'ing opencode.
USER root
ENTRYPOINT ["opencode-entrypoint"]
CMD ["serve", "--hostname", "0.0.0.0", "--port", "8008"]
