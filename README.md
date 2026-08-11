# Bob

An evolving AI system. `stack.yaml` is the source of truth for models, model-server presets, and agent exposure. Generators turn that into a model-server INI, Pi config, and OpenCode config; Docker runs the server and agents.

```
stack.yaml ──generate-*──▶ config/* ──mount──▶ model-server / pi / opencode
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
./ctl.sh generate-pi-config
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

Rebuild agent images (base → pi → opencode) with `./ctl.sh rebuild-agents`.

## Repository layout

```
bob/
├── ctl.sh                           # control surface — start here
├── stack.yaml                       # single source of truth
├── AGENTS.md                        # agent session entrypoint
├── config/
│   ├── config.generated.ini         # model-server preset (mounted as /config/config.ini)
│   ├── pi/{models,settings}.json    # Pi agent config
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
      ├── OpenAI-compat──▶ pi (profile: pi)
      └── OpenAI-compat──▶ opencode (profile: opencode)
```

- **model-server** — llama.cpp; reads generated `config.generated.ini`
- **model-downloader** — fetches GGUF/mmproj files (opt-in profile)
- **pi** / **opencode** — coding agents on `bob-agent-base`; configs from `stack.yaml`

## Documentation

| Doc | Role |
|-----|------|
| [`AGENTS.md`](AGENTS.md) | Agent session entrypoint, workflow, gotchas |
| [`docs/reference.md`](docs/reference.md) | `stack.yaml` schema, bootstrap behaviour, agents, tooling |
| [`docs/index.md`](docs/index.md) | Specs / decisions / plans lifecycle |
