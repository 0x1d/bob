FROM node:24-trixie-slim

# base: Node 24 LTS (v24.19.x) on Debian 13 (trixie).
# This image is the shared foundation for Bob agent containers (Pi and any
# future CLI agents). It ships a curated dev / research / analysis toolset so
# agents can edit, build, inspect, and probe local and remote systems from
# inside the container.
#
# NOTE: the grouped comment blocks below are the source of truth for the tool
# list. README.md ("Agent containers" > toolset bullets) MUST be updated in the
# same change whenever a tool is added, removed, or re-versioned here — that
# README list is the contract for what every agent container can assume is
# available.
#
# Agent-specific packages (e.g. @earendil-works/pi-coding-agent)
# are layered on top in their own Dockerfiles.

# apt layer (one install + cleanup for a smaller image):
#   * build & version control: git, build-essential, make, pkg-config, gh (GitHub CLI)
#   * editors / pagers:        vim-tiny (aliased to vim), less
#   * text / data:             ripgrep, fd-find, fzf, jq, xmlstarlet, bc, file, tree
#   * archive / sync:          curl, wget, ca-certificates, rsync, zip, unzip, tar
#   * shells / multiplex:      tmux, bash-completion
#   * monitoring:              htop, nvtop (AppImage extracted below; GPU via compose gpus)
#   * networking & analysis:   dnsutils (dig/host/nslookup), iproute2 (ip/ss),
#                              netcat-openbsd, traceroute, tcpdump, nmap,
#                              openssh-client, bsdmainutils (column/hexdump),
#                              procps (ps/pgrep/top), lsof
#   * scripting / glue:        python3, python3-pip, python3-venv, gawk, sed
#   * databases (remote):      default-mysql-client, postgresql-client
#   * config management:      ansible
#   * privilege drop:          gosu (entrypoints run as root, drop to agent)
#   * AppImage extract deps:   libfuse2 (for --appimage-extract-and-run fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git build-essential make pkg-config \
      vim-tiny less \
      ripgrep fd-find fzf jq xmlstarlet bc file tree \
      curl wget ca-certificates rsync zip unzip tar \
      tmux bash-completion \
      htop libfuse2 \
      dnsutils iproute2 netcat-openbsd traceroute tcpdump nmap \
      openssh-client bsdmainutils procps lsof \
      python3 python3-pip python3-venv gawk \
      default-mysql-client postgresql-client \
      ansible \
      gosu gnupg \
      gh \
    && ln -s /usr/bin/fdfind /usr/local/bin/fd \
    && ln -s /usr/bin/vim.tiny /usr/local/bin/vim \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI (client + buildx + compose plugins). Used by k3d and direct
# docker/docker compose calls against the host daemon via the mounted socket.
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/* \
    && docker --version

# yq — mikefarah/yq (the go standalone YAML processor), the de-facto standard.
ARG YQ_VERSION=v4.53.3
RUN curl -fsSL https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64.tar.gz \
      -o /tmp/yq.tgz \
    && tar -xzf /tmp/yq.tgz -C /tmp \
    && mv /tmp/yq_linux_amd64 /usr/local/bin/yq \
    && chmod +x /usr/local/bin/yq \
    && rm -rf /tmp/yq.tgz /tmp/yq.1 /tmp/install-man-page.sh

# nvtop — NVIDIA/AMD/Intel GPU top. Upstream ships only an AppImage for x86_64;
# extract it at build time (squashfs-root) so it runs without FUSE at runtime.
# Requires GPU access — agent compose services pass `gpus: all`.
ARG NVTOP_VERSION=3.3.2
RUN curl -fsSL https://github.com/Syllo/nvtop/releases/download/${NVTOP_VERSION}/nvtop-${NVTOP_VERSION}-x86_64.AppImage \
      -o /tmp/nvtop.AppImage \
    && chmod +x /tmp/nvtop.AppImage \
    && cd /opt && /tmp/nvtop.AppImage --appimage-extract >/dev/null 2>&1 \
    && mv /opt/squashfs-root /opt/nvtop \
    && rm -f /tmp/nvtop.AppImage \
    && printf '#!/bin/sh\nexec /opt/nvtop/AppRun "$@"\n' > /usr/local/bin/nvtop \
    && chmod +x /usr/local/bin/nvtop

# rtk — Rust Token Killer (https://rtk-ai.app). Compresses CLI command output
# (~60-90% fewer tokens) before it reaches the model's context window. Pi wires
# it up via an auto-installed extension.
ARG RTK_VERSION=v0.45.0
RUN curl -fsSL https://github.com/rtk-ai/rtk/releases/download/${RTK_VERSION}/rtk-x86_64-unknown-linux-musl.tar.gz \
      -o /tmp/rtk.tgz \
    && tar -xzf /tmp/rtk.tgz -C /usr/local/bin rtk \
    && chmod +x /usr/local/bin/rtk \
    && rm -f /tmp/rtk.tgz

# Infra / DevOps (pinned releases for reproducibility):
#   * IaC & secrets: terraform, vault (HashiCorp)
#   * kubernetes:    kubectl, helm, kubectx, kubens, k9s, kustomize, stern,
#                    k3d, argocd, velero, kubeseal
#   * containers:    docker CLI (talks to host daemon via mounted socket)
ARG TERRAFORM_VERSION=1.14.0
ARG VAULT_VERSION=1.21.1
ARG HELM_VERSION=v3.17.3
ARG K9S_VERSION=v0.50.6
ARG KUBECTX_VERSION=v0.9.5
ARG KUSTOMIZE_VERSION=v5.6.0
ARG STERN_VERSION=v1.33.0
ARG K3D_VERSION=v5.9.0
ARG ARGOCD_VERSION=v3.5.0
ARG VELERO_VERSION=v1.18.2
ARG KUBESEAL_VERSION=v0.38.4
RUN curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" \
      -o /tmp/terraform.zip \
    && unzip -q -j /tmp/terraform.zip terraform -d /usr/local/bin \
    && rm -f /tmp/terraform.zip \
    && curl -fsSL "https://releases.hashicorp.com/vault/${VAULT_VERSION}/vault_${VAULT_VERSION}_linux_amd64.zip" \
      -o /tmp/vault.zip \
    && unzip -q -j /tmp/vault.zip vault -d /usr/local/bin \
    && rm -f /tmp/vault.zip \
    && curl -fsSL "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
      -o /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl \
    && curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" \
      -o /tmp/helm.tgz \
    && tar -xzf /tmp/helm.tgz -C /tmp \
    && mv "/tmp/linux-amd64/helm" /usr/local/bin/helm \
    && rm -rf /tmp/helm.tgz /tmp/linux-amd64 \
    && curl -fsSL "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_amd64.tar.gz" \
      -o /tmp/k9s.tgz \
    && tar -xzf /tmp/k9s.tgz -C /tmp k9s \
    && mv /tmp/k9s /usr/local/bin/k9s \
    && rm -f /tmp/k9s.tgz \
    && curl -fsSL "https://github.com/ahmetb/kubectx/releases/download/${KUBECTX_VERSION}/kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz" \
      -o /tmp/kubectx.tgz \
    && tar -xzf /tmp/kubectx.tgz -C /tmp kubectx \
    && mv /tmp/kubectx /usr/local/bin/kubectx \
    && rm -f /tmp/kubectx.tgz \
    && curl -fsSL "https://github.com/ahmetb/kubectx/releases/download/${KUBECTX_VERSION}/kubens_${KUBECTX_VERSION}_linux_x86_64.tar.gz" \
      -o /tmp/kubens.tgz \
    && tar -xzf /tmp/kubens.tgz -C /tmp kubens \
    && mv /tmp/kubens /usr/local/bin/kubens \
    && rm -f /tmp/kubens.tgz \
    && curl -fsSL "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2F${KUSTOMIZE_VERSION}/kustomize_${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" \
      -o /tmp/kustomize.tgz \
    && tar -xzf /tmp/kustomize.tgz -C /usr/local/bin kustomize \
    && rm -f /tmp/kustomize.tgz \
    && curl -fsSL "https://github.com/stern/stern/releases/download/${STERN_VERSION}/stern_${STERN_VERSION#v}_linux_amd64.tar.gz" \
      -o /tmp/stern.tgz \
    && tar -xzf /tmp/stern.tgz -C /usr/local/bin stern \
    && rm -f /tmp/stern.tgz \
    && curl -fsSL "https://github.com/k3d-io/k3d/releases/download/${K3D_VERSION}/k3d-linux-amd64" \
      -o /usr/local/bin/k3d \
    && chmod +x /usr/local/bin/k3d \
    && curl -fsSL "https://github.com/argoproj/argo-cd/releases/download/${ARGOCD_VERSION}/argocd-linux-amd64" \
      -o /usr/local/bin/argocd \
    && chmod +x /usr/local/bin/argocd \
    && curl -fsSL "https://github.com/vmware-tanzu/velero/releases/download/${VELERO_VERSION}/velero-${VELERO_VERSION}-linux-amd64.tar.gz" \
      -o /tmp/velero.tgz \
    && tar -xzf /tmp/velero.tgz -C /tmp \
    && mv "/tmp/velero-${VELERO_VERSION}-linux-amd64/velero" /usr/local/bin/velero \
    && rm -rf /tmp/velero.tgz "/tmp/velero-${VELERO_VERSION}-linux-amd64" \
    && curl -fsSL "https://github.com/bitnami-labs/sealed-secrets/releases/download/${KUBESEAL_VERSION}/kubeseal-${KUBESEAL_VERSION#v}-linux-amd64.tar.gz" \
      -o /tmp/kubeseal.tgz \
    && tar -xzf /tmp/kubeseal.tgz -C /usr/local/bin kubeseal \
    && rm -f /tmp/kubeseal.tgz \
    && terraform version \
    && vault version \
    && kubectl version --client=true \
    && helm version --short \
    && k9s version \
    && kustomize version \
    && stern --version \
    && k3d version \
    && argocd version --client --short \
    && velero version --client-only \
    && kubeseal --version \
    && command -v kubectx kubens >/dev/null

# tmux config so modified keys (Shift+Enter, Ctrl+Enter, Alt+Enter) survive
# inside a tmux session under Pi. Per https://pi.dev/docs/latest/tmux this is
# the recommended setup; requires tmux >= 3.5 (trixie ships 3.5a).
# Ships as a system file at /etc/tmux.conf and symlinked into the agent user's
# home (below) so a bind-mount over /workspace or ~/.pi/agent never clobbers it.
RUN printf 'set -g extended-keys on\nset -g extended-keys-format csi-u\n' \
      > /etc/tmux.conf

# Helper used by agent entrypoints to add the agent user to the host docker
# socket's owning group before dropping privileges.
COPY docker-socket-setup.sh /usr/local/lib/agent/docker-socket-setup.sh
RUN chmod +x /usr/local/lib/agent/docker-socket-setup.sh

# Runtime user. All agents run as non-root `agent` (uid:gid 1000:1000) to match
# the host user `master` (uid 1000), so files the agent writes into mounted
# host dirs land readable/writable on the host without root-owned litter. The
# node base image already provides a `node` user/group at uid:gid 1000; we
# rename it to `agent` (keeps uid/gid 1000) rather than create a conflicting
# one. Supplementary `video`/`render` groups are not needed here: with compose
# `gpus: all` and `runtime: nvidia`, the NVIDIA Container Toolkit injects GPU
# device nodes with container-friendly permissions.
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

# Agent entrypoints start as root to fix volume ownership and add agent to the
# host docker socket's GID, then drop to agent via gosu before exec'ing the
# agent binary.
USER root
