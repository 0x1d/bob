FROM bob-agent-base

# OpenCode agent (https://opencode.ai). The base image already provides the
# shared dev/research/analysis toolset; this layer only installs the OpenCode
# CLI, exposes the web UI port, and adds the privilege-dropping entrypoint.

RUN npm install -g opencode-ai

# Expose the OpenCode web UI port.
EXPOSE 8008
ENV PORT=8008

COPY opencode-entrypoint.sh /usr/local/bin/opencode-entrypoint
RUN chmod +x /usr/local/bin/opencode-entrypoint

# Entrypoint starts as root to fix volume ownership and add agent to the host
# docker socket's GID, then drops to agent via gosu before exec'ing opencode.
ENTRYPOINT ["opencode-entrypoint"]
CMD ["serve", "--hostname", "0.0.0.0", "--port", "8008"]
