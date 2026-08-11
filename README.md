# Bob

A self-bootstrapping llama.cpp deployment: one YAML file (`stack.yaml`) is the
single source of truth for which models to download, how to configure them in
the model-server, and how to expose them to the Pi and OpenCode coding agents. A
Python generator (`scripts/bootstrap.py`) turns that into a model-server
models-preset INI, a Pi `models.json`, and an OpenCode `opencode.json`. Docker
sidecars fetch the model files and run the agents.

```
stack.yaml ──generate-config────▶ config/config.generated.ini ──mount──▶ model-server
     │                                       (mounts as /config/config.ini)
      ├──generate-pi-config──▶ config/pi/{models,settings}.json ──mount──▶ pi agent
      ├──generate-opencode-config──▶ config/opencode/opencode.json ──mount──▶ opencode agent
      └──download──▶ models/*.gguf ──mount──┐
             ▲                                 │
             │  profiles: [download]          │      profiles: [pi|opencode]
             model-downloader sidecar          pi / opencode agent containers
             (pure python + pyyaml)            (share bob-agent-base image)
```

## Repository layout

```
bob/
├── stack.yaml                       # single source of truth (models + agents)
├── config/
│   ├── config.generated.ini        # generated preset; compose mounts as /config/config.ini
│   ├── pi/{models,settings}.json   # generated Pi agent config; mounted as ~/.pi/agent
│   └── opencode/opencode.json      # generated OpenCode config; mounted as ~/.config/opencode
├── models/<model-dir>/*.gguf        # downloaded model + mmproj files
├── scripts/bootstrap.py             # generate-config | generate-*-config | download | status
├── scripts/build-agents.sh          # build shared base + agent images in order
├── docker/
│   ├── base.Dockerfile              # shared tooling image for all agents
│   ├── pi.Dockerfile                # Pi agent (extends bob-agent-base)
│   ├── opencode.Dockerfile          # OpenCode agent (extends bob-agent-base)
│   └── model-downloader.Dockerfile
└── docker-compose.yaml              # model-server + model-downloader + agents (profiled)
```

## Quick start

The model-server only ever reads `config/config.generated.ini` (the compose
file mounts it as `/config/config.ini`), so there is no hand-maintained INI
to diff or promote. `stack.yaml` is the only thing you edit.

```bash
cd /home/master/src/bob

# 1. Generate the model-server preset + agent configs from stack.yaml
python3 scripts/bootstrap.py generate-config
python3 scripts/bootstrap.py generate-pi-config
python3 scripts/bootstrap.py generate-opencode-config

# 2. Fetch any missing models via the sidecar (see "Downloading models")
docker compose --profile download run --rm model-downloader

# 3. (Re)start the server
docker compose up -d model-server

# 4. Run an agent (see "Pi agent" / "OpenCode agent")
docker compose --profile pi run --rm pi
docker compose --profile opencode up -d opencode
```

To inspect what's on disk at any time:

```bash
python3 scripts/bootstrap.py status           # present + local bytes
python3 scripts/bootstrap.py status --verify  # also fetch HF sizes, show match
```

## `stack.yaml` — the single source of truth

`stack.yaml` is split into top-level concerns so it can grow beyond a model
server. `stack:` holds shared paths, `huggingface:` the HF connection,
`models:` is the model-server model roster, and `pi:` / `opencode:` configure
the agent containers that talk to the model-server.

Each entry under `models:` declares one model — both its download source and
its model-server preset entry:

```yaml
- name: Qwythos-9B-Claude-Mythos-uncensored-Q6_K   # the model identity AND config.ini [name]
  dir: Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-Q6_K  # models/ subfolder
  repo: llmfan46/Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-GGUF
  quant: Q6_K
  family: qwen3.5
  thinking: true
  files:
    - name: Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-Q6_K.gguf
      kind: model
      size: 7458301696              # expected byte size (used by --verify)
    - name: Qwythos-9B-…-mmproj-BF16.gguf
      kind: mmproj
      size: 921704480
  settings:                         # emitted verbatim into config.ini, in order
    ctx-size: 200000
    temp: 0.6
    top-p: 0.95
    top-k: 20
    repeat-penalty: 1.05
    ngl: 100
    no-prefill-assistant: true
    cache-type-k: q4_0
    cache-type-v: q4_0
  card:                             # documentation only, NOT emitted to config.ini
    url: https://huggingface.co/llmfan46/Qwythos-9B-…
    sampling: {temp: 0.6, top-p: 0.95, top-k: 20, repetition_penalty: 1.05, max_new_tokens: 16384}
    context: 1048576 (1M) via YaRN factor 4.0 over 262144 native
    reasoning: true
    multimodal: true
    tool-calling: true
```

### `name`

`name` is the canonical identity of the entry — the human-friendly model name,
the config.ini `[...]` header, what `--only` filters on, what `status`
displays, and what future `agents:` entries will reference. There is no
separate `section` field; `name` *is* the header.

Key fields:

| field                  | meaning |
|------------------------|---------|
| `name`                 | Canonical model identity — the config.ini `[...]` header, filters `--only`, shown by `status`, referenced by future `agents:` |
| `dir`                  | Subfolder under `models/` where the `.gguf` files live |
| `repo`                 | Hugging Face repo (`org/name`) used to build download URLs |
| `quant` / `family`     | Informational tags |
| `thinking`             | Informational; whether the card calls this a reasoning model |
| `files[].name`         | **Local** filename (the one `config.ini` references) |
| `files[].remote`       | **Remote** filename on HF (optional; defaults to `name`). Use this when the upstream file is named differently, e.g. `mmproj-F32.gguf` on HF but stored locally as `mmproj-Qwopus…-BF16.gguf`. |
| `files[].kind`         | `model` or `mmproj` — decides which `config.ini` line it produces |
| `settings`             | Ordered map emitted verbatim as `key = value` lines; also feeds Pi `samplingParams` (see below) |
| `card`                 | Upstream recommendation + URL, kept for traceability; never written to `config.ini` |

The top-level `pi:` block configures the Pi agent connection:

| field          | meaning |
|----------------|---------|
| `pi.provider`      | Provider key written into `models.json` (default `bob-stack`) |
| `pi.base_url`      | OpenAI-compat endpoint reachable from the pi container (default `http://model-server:6060/v1`) |
| `pi.default_model`  | Model `name` selected by default in Pi's `/model` (falls back to the first entry in `models:` if unset) |
| `pi.api_key_env`    | Optional; env var whose value becomes `apiKey`. Unset → dummy `"none"` (the server has no auth) |

The top-level `opencode:` block configures the OpenCode agent connection:

| field          | meaning |
|----------------|---------|
| `opencode.provider`      | Provider key written into `opencode.json` (default `llama-server`) |
| `opencode.base_url`      | OpenAI-compat endpoint reachable from the opencode container (default `http://model-server:6060/v1`) |
| `opencode.default_model`  | Default model selected on first launch (falls back to the first entry in `models:` if unset) |
| `opencode.api_key_env`    | Optional; env var whose value is injected into the provider options. Unset → no key (the server has no auth) |
| `opencode.server`         | `port` / `hostname` for the OpenCode web UI server (default `{"port": 8008, "hostname": "0.0.0.0"}`) |

## bootstrap.py reference

`bootstrap.py --config <path>` accepts global `--models-dir` / `--config-dir`
overrides (used by the sidecar so it can target the container mount layout at
`/models` and `/config` regardless of the YAML defaults).

### `generate-config`

```
python3 scripts/bootstrap.py generate-config
```

Writes `<host_config_dir>/config.generated.ini`. The model-server's compose
mount points at that file (`./config/config.generated.ini:/config/config.ini`),
so a single run regenerates the live preset — no copy/diff/apply step.

Value formatting: booleans → `true`/`false`; dicts → compact JSON
(`{"enable_thinking":false}`); floats are preserved as floats
(`1.0` stays `1.0`, not `1`).

### `generate-pi-config`

```
python3 scripts/bootstrap.py generate-pi-config
```

Writes `<host_config_dir>/pi/models.json` and `pi/settings.json` for the Pi
terminal coding agent (https://pi.dev/docs/latest). One Pi custom provider
(`openai-completions`) points at `pi.base_url`; every stack.yaml model becomes
a Pi model entry. The mapping from the model-server preset to Pi:

| stack.yaml source            | Pi model field |
|------------------------------|----------------|
| `name`                       | `id`, `name` (matches the model-server preset id) |
| `thinking`                   | `reasoning` |
| `ctx-size`                   | `contextWindow` |
| `reasoning-budget` (> 0)     | `maxTokens` |
| `temp`,`top-p`,`top-k`,`min-p`,`repeat-penalty` | `samplingParams` keys (`temperature`,`top_p`,`top_k`,`min_p`,`repeat_penalty`) — merged verbatim into every Pi request body |

`samplingParams` is the single source of sampling truth on the Pi side; the
model-server preset independently enforces the same defaults server-side, so
direct API callers get them too. Provider `compat` sets
`supportsDeveloperRole: false` / `supportsReasoningEffort: false` (local
llama.cpp ignores those). The provider `apiKey` is the dummy `"none"` (the
server has no auth) so models appear in Pi's `/model`.

### `generate-opencode-config`

```
python3 scripts/bootstrap.py generate-opencode-config
```

Writes `<host_config_dir>/opencode/opencode.json` for the OpenCode agent
(https://opencode.ai). One OpenCode custom provider (`@ai-sdk/openai-compatible`)
points at `opencode.base_url`; every stack.yaml model becomes an OpenCode model
entry. The mapping from the model-server preset to OpenCode:

| stack.yaml source            | OpenCode field |
|------------------------------|----------------|
| `name`                       | model key, `name` (matches the model-server preset id) |
| `card.multimodal`            | `modalities.input` gains `"image"` in addition to `"text"` |
| `opencode.server`            | `server.port` / `server.hostname` |
| `opencode.default_model`     | `model` / `small_model` |

The provider `options.baseURL` points at the model-server; no `apiKey` is set
unless `opencode.api_key_env` is configured. The generated config also enables
the `browsermcp` MCP server from the upstream OpenCode example.

### `download`

```
python3 scripts/bootstrap.py download [--force] [--verify] [--only NAME ...]
```

Fetches every missing `.gguf` / `.mmproj` from Hugging Face using resumable
HTTP Range requests. `HF_TOKEN` (from env) is forwarded as a Bearer token for
gated repos and rate-limit relief.

**Existing files are never overwritten unless you explicitly pass `--force`.**

The decision happens before any network call: if the local target exists and
`--force` is not set, the function returns immediately and the file is left
untouched (`scripts/bootstrap.py:_download_one`). This is deliberate — a model
that loads fine must not be silently wiped by a re-run, even if its byte size
disagrees with Hugging Face.

No per-file `size:` has to be recorded in `stack.yaml`. When `--verify` is
passed, the expected size is looked up live from the Hugging Face file listing
(`GET /api/models/<repo>/tree/main`) and compared against the bytes on disk.

Behaviour matrix:

| local file | `--force` | `--verify` | action |
|------------|-----------|------------|--------|
| missing    | any       | any        | download |
| exists     | not set   | any        | **skip (file untouched)**; print `exists: <path>` |
| exists     | set       | any        | re-download from scratch (`wb`) |
| exists     | not set   | set        | size mismatch (vs HF) is **reported only** — `exists (size X != expected Y; leaving file, remove it to re-download)`; the file is kept |

`--only NAME` restricts the run to one or more model names (repeatable) — handy
for fetching a single model without touching the rest.

`--verify` makes the exit code non-zero if any downloaded file size != the HF
size, so the sidecar/job fails loudly on a truncated download.

### `status`

```
python3 scripts/bootstrap.py status [--verify] [--only NAME ...]
```

Without `--verify`: prints present yes/no + local bytes for every declared file
(no network — safe offline). With `--verify`: additionally fetches the Hugging
Face file listing and prints `expected` bytes + a `match` column. Use this to
spot corrupted/truncated downloads (the Qwythos-Q6_K incident that motivated
this tool showed up immediately as a local size far below expected).

## Downloading models (sidecar)

The `model-downloader` service in `docker-compose.yaml` is gated behind
`profiles: [download]`, so a normal `docker compose up` does **not** start it.
It only runs when explicitly invoked:

```bash
# One-off: download any missing models (resumable, skips existing by default)
docker compose --profile download run --rm model-downloader

# Re-download everything (ignores existing local files)
docker compose --profile download run --rm model-downloader \
  /workspace/scripts/bootstrap.py \
  --models-dir /models --config-dir /config download --force

# Download just one model
docker compose --profile download run --rm model-downloader \
  /workspace/scripts/bootstrap.py \
  --models-dir /models --config-dir /config download --only Qwythos-9B-Claude-Mythos-uncensored-Q6_K
```

The sidecar mounts `./models:/models`, `./config:/config`, `./stack.yaml` and
`./scripts` read-only, so:

- downloaded files land in `./models/` just like the server expects,
- and `config.generated.ini` produced inside the container lands in `./config/`.

To (re)build the sidecar image after editing the Dockerfile:

```bash
docker compose --profile download build model-downloader
```

### Hugging Face token

For gated repos or to ease rate limits, export `HF_TOKEN` before running the
sidecar; it's passed through via the `HF_TOKEN` env var (the YAML's
`huggingface.token_env` names the variable to read):

```bash
export HF_TOKEN=hf_xxx
docker compose --profile download run --rm -e HF_TOKEN model-downloader
```

## Agent containers

Both the Pi and OpenCode agents run from a shared base image (`bob-agent-base`,
built from `docker/base.Dockerfile`). The base image is `node:24-trixie-slim`
(Node 24 LTS on Debian 13 trixie) and ships a curated dev / research / analysis
toolset so agents can edit, build, inspect, and probe local and remote systems
from inside the container. Agent-specific packages and entrypoints are layered
on top in `docker/pi.Dockerfile` and `docker/opencode.Dockerfile`.

Because the agent Dockerfiles reference the local `bob-agent-base` image, the
base must be built before the agent images:

```bash
# build base + pi + opencode in the correct order
./scripts/build-agents.sh

# or manually
docker build -t bob-agent-base -f docker/base.Dockerfile docker/
docker compose --profile pi build pi
docker compose --profile opencode build opencode
```

Shared toolset (available in every agent container):

- **token / context:** `rtk` (Rust Token Killer v0.45.0, https://rtk-ai.app) —
  compresses CLI output (~60-90% fewer tokens) before it reaches the model.
  Wired into Pi via an auto-installed extension; OpenCode can call it directly.
- **build & vcs:** `git`, `build-essential`, `make`, `pkg-config`, `gcc/g++`,
  `gh` (GitHub CLI 2.46.0; auth persists in the mounted agent dir)
- **editors / pagers:** `vim` (→`vim.tiny`, the default `EDITOR`/`VISUAL`), `less`; `PAGER`/`LESS` preset
- **text / data:** `ripgrep`, `fd` (→`fdfind`), `fzf`, `jq`, `yq` (mikefarah/yq v4.53.3), `xmlstarlet`, `bc`, `file`, `tree`
- **archive / sync:** `curl`, `wget`, `ca-certificates`, `rsync`, `zip`, `unzip`, `tar`
- **monitoring:** `htop` (CPU/mem), `nvtop` (NVIDIA/AMD/Intel GPU top, 3.3.2 AppImage extracted at build time; needs the compose `gpus: all`)
- **shells / multiplex:** `tmux`, `bash-completion`
- **networking & analysis:** `dig`/`host`/`nslookup` (dnsutils), `ip`/`ss` (iproute2),
  `nc` (netcat-openbsd), `traceroute`, `tcpdump`, `nmap`, `ssh`, `lsof`, `ps`/`top` (procps),
  `hexdump`/`column` (bsdmainutils)
- **scripting / glue:** `python3` (+ pip/venv), `gawk`, `sed`
- **databases (remote inspection):** `mysql` client, `psql`
- **config management:** `ansible`
- **IaC & secrets:** `terraform` (1.14.0), `vault` (1.21.1)
- **kubernetes:** `kubectl`, `helm` (3.17.3), `kubectx`, `kubens` (0.9.5), `k9s`
  (0.50.6), `kustomize` (5.6.0), `stern` (1.33.0 — multi-pod log tailing),
  `k3d` (5.9.0), `argocd` (3.5.0), `velero` (1.18.2), `kubeseal` (0.38.4)
- **containers:** `docker` CLI (+ buildx, compose plugins) via mounted host
  `/var/run/docker.sock` — enables `k3d cluster create`, `docker compose`, etc.
- **runtime helper:** `libfuse2` (AppImage unpack fallback)

`GIT_TERMINAL_PROMPT=0` is set so `git` fails loudly on missing creds instead
of hanging the agent on a prompt.

> **Keep this list in sync.** When you add or remove a tool in
> `docker/base.Dockerfile`, update the bullet list above in the same change —
> it is the contract for what every agent container can assume is available.
> The Dockerfile's header comment groups are the source of truth; this README
> list should mirror them exactly.

To inspect what's installed in a given agent image:

```bash
docker run --rm --entrypoint bash bob-pi -lc 'command -v git rg fd yq nmap tcpdump dig jq nvtop htop rtk gh terraform vault ansible docker kubectl helm kubectx kubens k9s kustomize stern k3d argocd velero kubeseal'
```

## Pi agent

The `pi` service (profile `pi`) runs the Pi terminal coding agent
(`@earendil-works/pi-coding-agent`, https://pi.dev/docs/latest) in a container.
It talks to the model-server via the OpenAI-compat endpoint, and its model list
+ per-model sampling come straight from `stack.yaml` via
`generate-pi-config` (see the mapping table above). The `pi` service is gated
behind `profiles: [pi]`, so normal `docker compose up` does not start it.

Rebuild after editing `docker/pi.Dockerfile` (see [Agent containers](#agent-containers)
for the shared base build):

```bash
docker compose --profile pi build pi
```

```bash
# (re)generate the Pi config from stack.yaml when the roster changes
python3 scripts/bootstrap.py generate-pi-config

# interactive TUI (empty workspace)
docker compose --profile pi run --rm pi

# run against a host code project: bind it as the workspace
docker compose --profile pi run --rm -v "$PWD:/workspace" -w /workspace pi

# non-interactive one-shot
docker compose --profile pi run --rm pi --provider bob-stack \
    --model Qwen3.5-4B-NoThink -p "Reply with exactly: PONG"
```

Pi's config dir (`config/pi/`, containing `models.json` + `settings.json`) is
mounted as `~/.pi/agent` and persists on the host, so anything Pi writes
there (`auth.json`, model-store cache, …) survives restarts. The default
provider is `bob-stack`; the default model is `pi.default_model` from
`stack.yaml` (falls back to the first `models:` entry if unset). Inside the
Pi TUI, `/model` lists every stack model and `/model <name>` selects one; the
model-server auto-loads its preset on demand.

## OpenCode agent

The `opencode` service (profile `opencode`) runs the OpenCode agent
(`opencode-ai`, https://opencode.ai) in a container. It talks to the
model-server via the OpenAI-compat endpoint; its provider, model list, and
web UI server settings come straight from `stack.yaml` via
`generate-opencode-config` (see the mapping table above). The `opencode` service
is gated behind `profiles: [opencode]`, so normal `docker compose up` does not
start it. The web UI is exposed on host port `8008`.

Rebuild after editing `docker/opencode.Dockerfile` (see [Agent containers](#agent-containers)
for the shared base build):

```bash
docker compose --profile opencode build opencode
```

```bash
# (re)generate the OpenCode config from stack.yaml when the roster changes
python3 scripts/bootstrap.py generate-opencode-config

# start the headless OpenCode server with the web UI on port 8008
docker compose --profile opencode up -d opencode

# view logs
docker compose --profile opencode logs -f opencode

# one-shot CLI run inside the container
docker compose --profile opencode run --rm opencode run \
    -m llama-server/Qwen3.5-4B-NoThink \
    "Reply with exactly: PONG"
```

OpenCode's config dir (`config/opencode/`, containing `opencode.json`) is
mounted as `~/.config/opencode` and persists on the host, so anything OpenCode
writes there (auth, session state, …) survives restarts. The default provider is
`llama-server`; the default model is `opencode.default_model` from `stack.yaml`
(falls back to the first `models:` entry if unset). Multimodal models
(`card.multimodal: true`) advertise both text and image input in the generated
`opencode.json`.

## Pi agent modifications

This section tracks everything the stack changes about the Pi agent *itself*
(beyond just installing tools for it to call). Each entry lists what it does,
where it lives, and how it's maintained.

### rtk token compression (auto-installed extension)

- **What:** [rtk](https://rtk-ai.app) (Rust Token Killer v0.45.0, static musl
  binary in the image at `/usr/local/bin/rtk`) rewrites bash commands the Pi
  agent runs (`git status`, `find`, `grep`, `cargo test`, …) to their `rtk`
  equivalents, compressing output by ~60-90% before it enters the model's
  context window. Per https://www.rtk-ai.app/docs/getting-started/supported-agents/#pi,
  Pi integration is a TypeScript extension that listens on the `tool_call`
  event and delegates to `rtk rewrite`.
- **Where:** the extension file is `~/.pi/agent/extensions/rtk.ts` — i.e. on
  the host `config/pi/extensions/rtk.ts` (inside the `./config/pi` mount,
  which is gitignored along with all of `config/`). It is **not** hand-written:
  it's generated by `rtk init --agent pi --global`.
- **How maintained:** the image's entrypoint (`/usr/local/bin/pi-entrypoint`)
  checks whether `~/.pi/agent/extensions/rtk.ts` exists; if not, it runs
  `rtk init --agent pi --global` on first launch, which writes the extension
  into the mounted host dir. Subsequent launches find the file present and skip
  re-init (idempotent). To reset, delete `config/pi/extensions/rtk.ts` and
  relaunch; the extension is recreated from the pinned `rtk` binary. To upgrade
  rtk, bump `RTK_VERSION` in `docker/pi.Dockerfile`, rebuild, then delete the
  extension file so it regenerates with the new version.
- **Override:** `RTK_DISABLED=1 <cmd>` runs a command uncompressed (see rtk docs).

### tmux extended-keys config

- **What:** `set -g extended-keys on` + `set -g extended-keys-format csi-u`
  (the Pi-recommended setup, https://pi.dev/docs/latest/tmux) so
  `Shift+Enter` / `Ctrl+Enter` / `Alt+Enter` stay distinct inside tmux instead
  of collapsing to plain `Enter` (which would break Pi's newline keybindings).
- **Where:** baked into the image at `/etc/tmux.conf`, symlinked from
  `/root/.tmux.conf`. Built into the image layer (not host-mounted), so a
  bind-mount over `~/.pi/agent` or `/workspace` cannot clobber it.
- **How maintained:** edit `/etc/tmux.conf` in `docker/base.Dockerfile` and
  rebuild. Requires tmux ≥ 3.5 (trixie ships 3.5a).

### default editor / shell env

- **What:** `EDITOR=vim` / `VISUAL=vim` (Ctrl+G external editor), `PAGER=less`
  with `LESS=FRX`, `GIT_TERMINAL_PROMPT=0` (git fails loudly on missing creds
  instead of hanging the agent). Set in `docker/base.Dockerfile` via `ENV`.
- **How maintained:** edit the `ENV` block in `docker/base.Dockerfile` and rebuild.

### gh CLI auth storage

- **What:** the GitHub CLI (`gh` 2.46.0) stores config + auth tokens in
  `GH_CONFIG_DIR` (default `~/.config/gh`). The image sets `GH_CONFIG_DIR` to
  `/home/agent/.pi/agent/gh` — inside the `./config/pi` host mount — so `gh auth
  login` run once inside the container persists across restarts and is
  gitignored along with the rest of `config/`.
- **Where to authenticate:** from outside Pi (entrypoint bash):

  ```bash
  docker compose --profile pi run --rm --entrypoint bash bob-pi -lc 'gh auth login'
  ```

  Follow the prompts (browser/device flow). Credentials land at
  `config/pi/gh/hosts.yml` on the host. Verify with `gh auth status`.
- **How maintained:** the `GH_CONFIG_DIR` setting lives in the `ENV` block of
  `docker/pi.Dockerfile`. Re-pointing it requires edit + rebuild; the mounted
  `config/pi/` dir already contains it under the agent mount.

### Docker socket access (k3d / docker compose)

- **What:** the `pi` and `opencode` services mount the host Docker socket at
  `/var/run/docker.sock`. The base image ships the Docker CLI (+ buildx, compose
  plugins). On start, each agent entrypoint (running as root) adds the `agent`
  user to the socket's owning GID, then drops privileges with `gosu` before
  launching the agent — so `docker`, `docker compose`, and `k3d cluster create`
  work as the non-root agent user.
- **Where:** `docker-compose.yaml` volume mount;
  `docker/docker-socket-setup.sh` + `docker/pi-entrypoint.sh` +
  `docker/opencode-entrypoint.sh`.
- **How maintained:** socket mount is in compose; GID fixup is in the entrypoint
  scripts. Rebuild after editing `docker/base.Dockerfile` if you change the Docker
  CLI install.

## Model cards and sampling recommendations

`stack.yaml` encodes the per-model sampling settings recommended by each
upstream model card. Summary of what each card says (full text + URL in each
`card:` block):

| Section | Repo | Card recommends |
|---|---|---|
| `Qwen3.5-4B-NoThink` | HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive | non-thinking: temp 0.7 / top-p 0.8 / top-k 20 / min-p 0; keep ≥128K ctx; multimodal (mmproj); MTP support |
| `Qwen3.5-9B-Uncensored-Q4_K_M` | HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive | thinking: temp 0.6 / top-p 0.95 / top-k 20 / min-p 0; keep ≥128K ctx; multimodal (mmproj); MTP support |
| `Qwopus3.5-9B-Coder-MTP-Q4_K_M` | Jackrong/Qwopus3.5-9B-Coder-MTP-GGUF | temp 1.0 / top-p 0.95 / top-k 20 (official Qwen3.5 rec); MTP draft=2 (speculative decoding); reasoning `…`; multimodal (mmproj); tool calling |
| `Qwythos-9B-Claude-Mythos-uncensored-Q6_K` | llmfan46/Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-GGUF | temp 0.6 / top-p 0.95 / top-k 20 / repeat-penalty 1.05 / max_new_tokens 16384; 1M ctx via YaRN; reasoning; multimodal (mmproj); tool calling |

All four cards emphasise: greedy / very-low-temp sampling degenerates into
repetition loops on reasoning models — keep `temp ≥ 0.6` and the
`top-p`/`top-k` pair set.

## Safety guarantees

- `generate-config` only ever writes `config.generated.ini` (the file the
  compose mount exposes to the server). There's no path to hand-edit or
  accidentally clobber a separate `config.ini`.
- `generate-pi-config` only ever writes `config/pi/{models,settings}.json`.
- `generate-opencode-config` only ever writes `config/opencode/opencode.json`.
- `download` never overwrites an existing local file unless `--force` is passed.
- `download --verify` reports size mismatches (vs Hugging Face) without
  deleting or re-fetching; you delete the file yourself to trigger a clean
  re-download. No per-file `size:` is required in `stack.yaml`.
- The `model-downloader`, `pi`, and `opencode` services are opt-in
  (`--profile download` / `--profile pi` / `--profile opencode`); normal
  `docker compose up` starts only `model-server`.
