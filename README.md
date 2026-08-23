# Bob

Bob is a self-improving AI system powered by the OpenCode coding agent.  

```
stack.yaml ──generate-*──▶ config/* ──mount──▶ model-server / opencode
                │
                └──download──▶ models/*.gguf
```

## Control surface

All day-to-day operations go through `ctl.sh`. Run `./ctl.sh help` for the full
command list.

## Quick start

Edit only `stack.yaml`, then:

```bash
cd /home/master/src/bob

./ctl.sh generate-config
./ctl.sh generate-opencode-config
./ctl.sh download
./ctl.sh start
```

Useful checks:

```bash
./ctl.sh status            # local presence + bytes
./ctl.sh status --verify   # also compare against Hugging Face sizes
./ctl.sh logs              # model-server logs
./ctl.sh stop
```

Run the agent (interactive TUI, bind-mounts CWD to /workspace):

```bash
./ctl.sh opencode
```

The web UI is also available on host port 8008 via `./ctl.sh start`.

Rebuild agent images (base → opencode) with `./ctl.sh rebuild-agents`.

## Repository layout

```
bob/
├── ctl.sh                           # control surface — start here
├── stack.yaml                       # single source of truth
├── AGENTS.md                        # agent session entrypoint
├── config/
│   ├── config.generated.ini         # model-server preset (mounted as /config/config.ini)
│   └── opencode/opencode.json       # OpenCode config
├── models/<model-dir>/*.gguf
├── scripts/                         # ctl.sh command implementations + bootstrap.py
├── docker/                          # base + agent + downloader images
├── docker-compose.yaml
└── docs/                            # lifecycle docs + detailed reference
```

## Architecture

```
model-server ──network──▶ model-downloader (profile: download)
      │
      └── OpenAI-compat──▶ opencode (profile: opencode)
```

- **model-server** — llama.cpp; reads generated `config.generated.ini`
- **model-downloader** — fetches GGUF/mmproj files (opt-in profile)
- **opencode** — OpenCode coding agent on `bob-agent-base`; config from `stack.yaml`

## Documentation

| Doc | Role |
|-----|------|
| [`AGENTS.md`](AGENTS.md) | Agent session entrypoint, workflow, gotchas |
| [`docs/reference.md`](docs/reference.md) | `stack.yaml` schema, bootstrap behaviour, agents, tooling |
| [`docs/index.md`](docs/index.md) | Specs / decisions / plans lifecycle |
