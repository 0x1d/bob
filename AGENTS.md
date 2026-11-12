# Bob

[`README.md`](README.md) is the canonical description of the stack (commands,
services, layout, configuration); this file adds the rules for agent sessions.

## Control Surface

All system operations are performed via `ctl.sh`, the centralized control surface. Agents must interact through `ctl.sh` rather than invoking commands directly. Run `./ctl.sh help` to list available commands and their descriptions.

`stack.yaml` is the single source of truth: `ctl.sh generate` turns it into the model-server preset and the OpenCode `opencode.json`. Never edit files under `config/` by hand.
