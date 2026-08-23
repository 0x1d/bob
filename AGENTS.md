# Bob

Bob is a self-improving AI system based on Pi agent.  

## Configuration

`stack.yaml` is the source of truth for which models to download, how to configure them in the model-server, and how to expose them to the Pi coding agent. Python generator (`scripts/bootstrap.py`) turns that into a model-server preset and a Pi `models.json`. Docker sidecars fetch model files and run the agent.

## Control Surface

All system operations are performed via `ctl.sh`, the centralized control surface. Agents must interact through `ctl.sh` rather than invoking commands directly. Run `./ctl.sh help` to list available commands and their descriptions.

Detailed stack / bootstrap / agent reference: [`docs/reference.md`](docs/reference.md).

## Repo Layout

```
workspace/
├── ctl.sh                          # control surface — prefer over direct commands
├── stack.yaml                      # single source of truth (models + pi agent)
├── config/
│   ├── config.generated.ini        # generated preset; compose mounts as /config/config.ini
│   └── pi/{models,settings}.json   # generated Pi config; mounted as ~/.pi/agent
├── models/<model-dir>/*.gguf       # downloaded GGUF + mmproj files
├── scripts/                        # ctl.sh commands + bootstrap.py
├── scripts/build-agents.sh         # builds base → pi in order
└── docker/
    ├── base.Dockerfile              # shared tooling image (node:24-trixie-slim)
    ├── pi.Dockerfile                # extends bob-agent-base
    └── model-downloader.Dockerfile
```

## Setup

1. **Generate configs** — `ctl.sh generate-config`, `ctl.sh generate-pi-config`
2. **Download models** — `ctl.sh download`
3. **Start server** — `ctl.sh start`
4. **Rebuild agents** — `ctl.sh rebuild-agents`
5. **Run agent** — `ctl.sh pi` (interactive TUI; bind-mounts CWD to /workspace)

## Key Facts

| Fact | Detail |
|------|--------|
| **Model-server config** | Only ever reads `config/config.generated.ini` (compose mounts it as `/config/config.ini`); no hand-maintained INI to diff |
| **Download safety** | `download` never overwrites existing local files unless `--force` is passed; `--verify` reports size mismatches without deleting |
| **Agent images** | Base is `bob-agent-base` (Node 24 + full dev stack); Pi extends it; base must be built first |
| **Agent config dir** | Pi: `~/.pi/agent` (auth, model-store cache persist) |
| **Pi tools** | Auto-installs `rtk` (Rust Token Killer v0.45.0) extension on first launch; tmux `extended-keys` enabled in `/etc/tmux.conf` |
| **HF token** | `HF_TOKEN` env var forwarded to downloader for gated repos and rate-limit relief |
| **Default model** | Falls back to the first `models:` entry in `stack.yaml` if `pi.default_model` unset |
| **Profile services** | `model-downloader` and `pi` are gated behind `--profile` flags; normal `docker compose up` starts only `model-server` |

## Gotchas

- **Never overwrite existing models** — `download` respects existing local files by default; use `--force` only when intentionally re-fetching
- **Rebuild base before agents** — agent Dockerfiles extend `bob-agent-base`; building pi alone will fail until base exists
- **HF token for gated repos** — export `HF_TOKEN` before running the downloader sidecar if models require auth
- **Size mismatches are reported, not fixed** — `download --verify` prints `exists (size X != expected Y; leaving file, remove it to re-download)` and keeps the local file; you must delete and re-download if you want a clean fetch
- **Pi tmux config is baked in** — `extended-keys` config is in `/etc/tmux.conf` (image layer); host mount overrides cannot clobber it

## Architecture

The system is a 3-containers compose with profile gating:

```
model-server ──network──▶ model-downloader (profile: download)
      │
      └── OpenAI-compat──▶ pi (profile: pi)
```

- **model-server** — llama.cpp model server, config driven by `config/config.generated.ini`
- **model-downloader** — pure Python + pyyaml sidecar; mounts `./models:/models`, `./config:/config`
- **pi** — Pi terminal coding agent; uses `bob-stack` provider pointing at `pi.base_url`

The agent container shares the `bob-agent-base` image (Node 24-trixie-slim with curated dev/research toolset).

## Model Cards (per `stack.yaml` `card:` blocks)

| Model | Card recommends |
|-------|------------------|
| Qwen3.5-4B-NoThink | non-thinking: temp 0.7 / top-p 0.8; ≥128K ctx; multimodal; MTP support; anti-loop guardrail repeat-penalty 1.05 |
| Qwen3.5-9B-Uncensored-Q4_K_M | thinking: temp 0.6 / top-p 0.95 / top-k 20; ≥128K ctx; multimodal; MTP; anti-loop guardrail repeat-penalty 1.05 |
| Qwopus3.5-9B-Coder-MTP-Q4_K_M | temp 1.0 / top-p 0.95 / top-k 20; MTP draft=2 (speculative); reasoning; multimodal; tool calling; anti-loop guardrail repeat-penalty 1.05 |
| Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-Q6_K | temp 0.6 / top-p 0.95 / top-k 20 / repeat-penalty 1.05; 1M ctx via YaRN; reasoning; multimodal; tool calling |

All cards warn: greedy/very-low-temp degenerates into repetition loops on reasoning models — keep `temp ≥ 0.6`.

## Documentation Standards

The `docs/` folder follows a 7-stage lifecycle:

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
