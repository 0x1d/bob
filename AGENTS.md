# Bob

Bob is a self-improving AI system powered by the OpenCode 2 coding agent.
[`README.md`](README.md) is the canonical description of the stack (commands,
services, layout, configuration); this file adds the rules for agent sessions.

## Control Surface

All system operations are performed via `ctl.sh`, the centralized control surface. Agents must interact through `ctl.sh` rather than invoking commands directly. Run `./ctl.sh help` to list available commands and their descriptions.

`stack.yaml` is the single source of truth: `ctl.sh generate` turns it into the model-server preset and the OpenCode `opencode.json`. Never edit files under `config/` by hand.

## Key Facts

| Fact | Detail |
|------|--------|
| **Model-server config** | Only ever reads `config/config.generated.ini` (compose mounts it as `/config/config.ini`); no hand-maintained INI to diff |
| **Generated on start** | `ctl.sh start` runs `generate` first, so the running stack always matches `stack.yaml` |
| **Download safety** | `download` never overwrites existing local files unless `--force` is passed; `--verify` reports size mismatches without deleting |
| **Agent image** | One image, `docker/opencode.Dockerfile` (Node 24 + small utilities + OpenCode 2); build with `ctl.sh build` |
| **OpenCode version** | `@opencode/cli`, pinned by `OPENCODE_VERSION` in `docker/opencode.Dockerfile`; `opencode.json` uses the native V2 shape (`providers`, `permissions`, `mcp.servers`) |
| **OpenCode dirs** | Config at `~/.config/opencode` (host `config/opencode`), data at `~/.local/share/opencode` (host `config/opencode-data`) |
| **Web UI / TUI** | `opencode serve` on port 8008; `ctl.sh opencode` attaches a TUI to that same server; password from `OPENCODE_PASSWORD` or `config/opencode/server-password` |
| **Default model** | `opencode.default_model` in `stack.yaml`; falls back to the first `models:` entry |
| **Shared model settings** | Common settings/cards live under `x-shared:` in `stack.yaml` and are pulled in with YAML merge keys (`<<: *name`) |
| **HF token** | `HF_TOKEN` env var forwarded to the downloader for gated repos and rate-limit relief |
| **Profile services** | `model-downloader` and `opencode` are gated behind `--profile` flags; plain `docker compose up` starts only `model-server` |

## Gotchas

- **Never overwrite existing models** — `download` respects existing local files by default; use `--force` only when intentionally re-fetching
- **Size mismatches are reported, not fixed** — `download --verify` prints `exists (size X != expected Y; leaving file, remove it to re-download)` and keeps the local file; you must delete and re-download if you want a clean fetch
- **Ports are localhost-only** — 6060 and 8008 are published on `127.0.0.1` unless `BOB_BIND` is set; the opencode container has the host Docker socket, so do not widen this casually
- **Port 8008 is not in `opencode.json`** — `opencode serve` binds `0.0.0.0:8008` inside the container (set in `docker/opencode.Dockerfile`); V2 ignores a `server` config block
- **No compilers in the agent image** — `build-essential`, kubectl, terraform and similar are deliberately absent; add them in a derived image rather than the shared Dockerfile
- **Outside-workspace access asks first** — `opencode.permissions` in `stack.yaml` sets `external_directory` to `ask`

## Model Cards (per `stack.yaml` `card:` blocks)

| Model | Card recommends |
|-------|------------------|
| Qwen3.5-4B-NoThink | non-thinking: temp 0.7 / top-p 0.8; ≥128K ctx; multimodal; MTP support; anti-loop guardrail repeat-penalty 1.05 |
| Qwen3.5-9B-Uncensored-Q4_K_M | thinking: temp 0.6 / top-p 0.95 / top-k 20; ≥128K ctx; multimodal; MTP; anti-loop guardrail repeat-penalty 1.05 |
| Qwopus3.5-9B-Coder-MTP-Q4_K_M | temp 1.0 / top-p 0.95 / top-k 20; MTP draft=2 (speculative); reasoning; multimodal; tool calling; anti-loop guardrail repeat-penalty 1.05 |
| Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-Q6_K | temp 0.6 / top-p 0.95 / top-k 20 / repeat-penalty 1.05; 1M ctx via YaRN; reasoning; multimodal; tool calling |
| Ternary-Bonsai-2-27B-PQ2_0 (commented out in `stack.yaml`) | thinking: temp 1.0 / top-p 0.95 / top-k 20 / repeat-penalty 1.0; 262K ctx; multimodal (Q8_0 mmproj); tool calling; **requires PrismML llama.cpp fork** |

All cards warn: greedy/very-low-temp degenerates into repetition loops on reasoning models — keep `temp ≥ 0.6`.

## Documentation Standards

The `docs/` folder (created on first use; it does not exist yet) follows a 7-stage lifecycle:

1. **Research** (`docs/research/`) — document concepts, cite and link sources, link to specs
2. **Specs** (`docs/specs/`) — define what needs to be built, interfaces, success criteria
3. **Decisions** (`docs/decisions/`) — record architectural decisions with context, options, rationale
4. **Design** (`docs/design/`) — lock in architecture and tech stack choices
5. **Plans** (`docs/plans/`) — coordinate implementation work; link to specs
6. **Retrospectives** (`docs/retro/`) — capture lessons after work; link corresponding plan
7. **Index files** — each folder has a `README.md` linking all items in it

File naming conventions:
- Specs: domain + description (e.g., `memory/procedural.md`)
- Decisions: `DEC001.md`, `DEC002.md`, etc.
- Plans: `PLAN001.md`, `PLAN002.md`, etc.
- Retrospectives: `RETRO001.md`, `RETRO002.md`, etc.
- Research: `RES001.md`, `RES002.md`, etc.

## Documentation Entry Protocol (Required)

`AGENTS.md` is the task entrypoint for agent sessions. For documentation work,
agents must use a surgical ingestion flow to stay context-efficient:

1. Open `docs/index.md` for lifecycle overview and navigation rules.
2. Open exactly one relevant area index (`docs/specs/index.md`,
   `docs/plans/index.md`, `docs/decisions/index.md`, `docs/research/index.md`,
   `docs/retro/index.md`).
3. Read only linked documents required for the active task.
4. Update only impacted canonical `index.md` files and preserve legacy alias
   files (`README.md`, `SUMMARY.md`) as lightweight pointers.

### Consolidation Rule

Within each docs area, `index.md` is the canonical source. If an area contains
`README.md` and/or `SUMMARY.md`, they must not duplicate long-form content.
Keep them as compatibility entrypoints that point to the area `index.md`.

### Diagram Rule

All diagrams added or updated in docs must use mermaid.
