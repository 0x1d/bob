#!/usr/bin/env bash

set -e

# @cmd: start
# @desc: Regenerate configs and start services (default: model-server opencode)

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Regenerate first so the running stack never lags behind stack.yaml.
python3 "${SCRIPTS_DIR}/bootstrap.py" generate

# Extra args go to `docker compose up -d`, e.g. to run only the agent + web UI
# without loading any model:  ./ctl.sh start --no-deps opencode
if [ "$#" -eq 0 ]; then
  set -- model-server opencode
fi
docker compose --profile opencode up -d "$@"
