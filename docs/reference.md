# Bob reference

Detailed operational reference. Day-to-day commands belong in `./ctl.sh`
(see root [`README.md`](../README.md) and [`AGENTS.md`](../AGENTS.md)).
This document covers schema, generator behaviour, and agent internals.

## `stack.yaml`

Top-level sections: `stack:` (paths), `huggingface:`, `models:`, `pi:`,
`opencode:`.

Each `models:` entry declares both download source and model-server preset:

```yaml
- name: Qwythos-9B-Claude-Mythos-uncensored-Q6_K   # identity AND config.ini [name]
  dir: Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-Q6_K
  repo: llmfan46/Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-GGUF
  quant: Q6_K
  family: qwen3.5
  thinking: true
  files:
    - name: Qwythos-9B-Claude-Mythos-5-1M-uncensored-heretic-Q6_K.gguf
      kind: model
      size: 7458301696
    - name: Qwythos-9B-…-mmproj-BF16.gguf
      kind: mmproj
      size: 921704480
  settings:                         # emitted verbatim into config.ini
    ctx-size: 200000
    temp: 0.6
    top-p: 0.95
    top-k: 20
    repeat-penalty: 1.05
    ngl: 100
    no-prefill-assistant: true
    cache-type-k: q4_0
    cache-type-v: q4_0
  card:                             # docs only — NOT emitted to config.ini
    url: https://huggingface.co/llmfan46/Qwythos-9B-…
    sampling: {temp: 0.6, top-p: 0.95, top-k: 20, repetition_penalty: 1.05}
    context: 1048576 (1M) via YaRN
    reasoning: true
    multimodal: true
    tool-calling: true
```

| field | meaning |
|-------|---------|
| `name` | Canonical identity — config.ini `[...]` header, `--only` filter, `status`, agent defaults |
| `dir` | Subfolder under `models/` |
| `repo` | Hugging Face `org/name` |
| `quant` / `family` / `thinking` | Informational tags |
| `files[].name` | Local filename referenced by config.ini |
| `files[].remote` | Optional HF filename when it differs from local |
| `files[].kind` | `model` or `mmproj` |
| `settings` | Ordered map → `key = value` in config.ini; also feeds Pi `samplingParams` |
| `card` | Upstream recommendations; never written to config.ini |

### `pi:` / `opencode:`

| field | meaning |
|-------|---------|
| `*.provider` | Provider key in generated agent config |
| `*.base_url` | OpenAI-compat endpoint (default `http://model-server:6060/v1`) |
| `*.default_model` | Default model `name` (falls back to first `models:` entry) |
| `*.api_key_env` | Optional env var for API key; unset → no/dummy auth |
| `opencode.server` | Web UI `port` / `hostname` (default `8008` / `0.0.0.0`) |

## `ctl.sh` and `bootstrap.py`

`./ctl.sh <command>` dispatches to `scripts/<command>.sh`. Most generate /
download / status commands wrap `scripts/bootstrap.py`. Prefer `ctl.sh`; call
`bootstrap.py` directly only when you need flags the wrapper does not expose,
or when debugging inside the downloader container.

Global overrides: `bootstrap.py --config <path> --models-dir … --config-dir …`
(used by the sidecar mount layout at `/models` and `/config`).

### `generate-config`

```bash
./ctl.sh generate-config
```

Writes `config/config.generated.ini`. Compose mounts it as `/config/config.ini`
— no separate hand-maintained INI.

Value formatting: booleans → `true`/`false`; dicts → compact JSON; floats kept
as floats (`1.0` stays `1.0`).

### `generate-pi-config`

```bash
./ctl.sh generate-pi-config
```

Writes `config/pi/{models,settings}.json` ([Pi docs](https://pi.dev/docs/latest)).

| stack.yaml | Pi field |
|------------|----------|
| `name` | `id`, `name` |
| `thinking` | `reasoning` |
| `ctx-size` | `contextWindow` |
| `reasoning-budget` (> 0) | `maxTokens` |
| `temp`,`top-p`,`top-k`,`min-p`,`repeat-penalty` | `samplingParams` |

Provider `compat` disables developer-role / reasoning-effort (llama.cpp ignores
them). `apiKey` defaults to dummy `"none"` so models appear in `/model`.

### `generate-opencode-config`

```bash
./ctl.sh generate-opencode-config
```

Writes `config/opencode/opencode.json` ([OpenCode](https://opencode.ai)).

| stack.yaml | OpenCode field |
|------------|----------------|
| `name` | model key, `name` |
| `thinking` | `reasoning: true` + `interleaved: {field: reasoning_content}` |
| `card.multimodal` | `modalities.input` includes `"image"` |
| `opencode.server` | `server.port` / `server.hostname` |
| `opencode.default_model` | `model` / `small_model` |

`interleaved` tells OpenCode to read/replay llama.cpp’s `reasoning_content`
(OpenAI-compat deepseek reasoning format) so thinking survives multi-turn /
tool-call loops.

Also enables the `browsermcp` MCP server from the upstream example.

### `download`

```bash
./ctl.sh download [--force] [--verify] [--only NAME ...]
```

Resumable HTTP Range fetches from Hugging Face. `HF_TOKEN` is forwarded as
Bearer for gated repos / rate limits.

**Existing files are never overwritten unless `--force` is passed.** Size
mismatches under `--verify` are reported only; delete the file yourself to
re-fetch.

| local | `--force` | `--verify` | action |
|-------|-----------|------------|--------|
| missing | any | any | download |
| exists | unset | any | skip (untouched) |
| exists | set | any | re-download (`wb`) |
| exists | unset | set | report size mismatch; keep file |

`--verify` exits non-zero if any downloaded size ≠ HF size.

### `status`

```bash
./ctl.sh status [--verify] [--only NAME ...]
```

Without `--verify`: present yes/no + local bytes (offline-safe). With
`--verify`: also fetch HF listings and show `expected` / `match`.

## Downloader sidecar

`model-downloader` is behind `profiles: [download]`. Prefer `./ctl.sh download`
on the host. For container-side runs (mount layout `/models`, `/config`):

```bash
docker compose --profile download run --rm model-downloader

docker compose --profile download run --rm model-downloader \
  /workspace/scripts/bootstrap.py \
  --models-dir /models --config-dir /config download --force

export HF_TOKEN=hf_xxx
docker compose --profile download run --rm -e HF_TOKEN model-downloader
```

Rebuild: `docker compose --profile download build model-downloader`.

## Agent containers

Shared base: `bob-agent-base` from `docker/base.Dockerfile`
(`node:24-trixie-slim`). Build order matters:

```bash
./ctl.sh rebuild-agents
# or: ./ctl.sh rebuild-base   then profile builds for pi / opencode
```

### Shared toolset

Keep this list in sync with `docker/base.Dockerfile` header groups.

- **token / context:** `rtk` (Rust Token Killer v0.45.0)
- **build & vcs:** `git`, `build-essential`, `make`, `pkg-config`, `gcc/g++`, `gh` 2.46.0
- **editors / pagers:** `vim` (`EDITOR`/`VISUAL`), `less`; `PAGER`/`LESS` preset
- **text / data:** `ripgrep`, `fd`, `fzf`, `jq`, `yq` 4.53.3, `xmlstarlet`, `bc`, `file`, `tree`
- **archive / sync:** `curl`, `wget`, `ca-certificates`, `rsync`, `zip`, `unzip`, `tar`
- **monitoring:** `htop`, `nvtop` 3.3.2 (needs compose `gpus: all`)
- **shells / multiplex:** `tmux`, `bash-completion`
- **networking:** `dig`/`host`/`nslookup`, `ip`/`ss`, `nc`, `traceroute`, `tcpdump`, `nmap`, `ssh`, `lsof`, `ps`/`top`, `hexdump`/`column`
- **scripting:** `python3` (+ pip/venv), `gawk`, `sed`
- **databases:** `mysql` client, `psql`
- **config / IaC:** `ansible`, `terraform` 1.14.0, `vault` 1.21.1
- **kubernetes:** `kubectl`, `helm` 3.17.3, `kubectx`/`kubens` 0.9.5, `k9s` 0.50.6, `kustomize` 5.6.0, `stern` 1.33.0, `k3d` 5.9.0, `argocd` 3.5.0, `velero` 1.18.2, `kubeseal` 0.38.4
- **containers:** Docker CLI (+ buildx, compose) via host `/var/run/docker.sock`
- **runtime helper:** `libfuse2`

`GIT_TERMINAL_PROMPT=0` so git fails loudly on missing creds.

### Pi

Profile `pi`. Config from `generate-pi-config`; mount `config/pi/` → `~/.pi/agent`.

```bash
./ctl.sh generate-pi-config
docker compose --profile pi run --rm pi
docker compose --profile pi run --rm -v "$PWD:/workspace" -w /workspace pi
docker compose --profile pi run --rm pi --provider bob-stack \
    --model Qwen3.5-4B-NoThink -p "Reply with exactly: PONG"
```

### OpenCode

Profile `opencode`. Web UI on host port `8008`. `./ctl.sh start` brings up
model-server + opencode. Data dir: `config/opencode-data/` →
`~/.local/share/opencode`.

```bash
./ctl.sh generate-opencode-config
./ctl.sh start
docker compose --profile opencode logs -f opencode
docker compose --profile opencode run --rm opencode run \
    -m llama-server/Qwen3.5-4B-NoThink \
    "Reply with exactly: PONG"
```

## Pi agent modifications

### rtk extension

Auto-installed on first launch via `rtk init --agent pi --global` into
`config/pi/extensions/rtk.ts` (idempotent). Reset by deleting that file.
Upgrade: bump `RTK_VERSION` in `docker/pi.Dockerfile`, rebuild, delete
extension. Override: `RTK_DISABLED=1 <cmd>`.

### tmux extended-keys

Baked into `/etc/tmux.conf` in the image (Shift/Ctrl/Alt+Enter). Edit in
`docker/base.Dockerfile` and rebuild. Needs tmux ≥ 3.5.

### Editor / shell env

`EDITOR`/`VISUAL=vim`, `PAGER=less`, `LESS=FRX`, `GIT_TERMINAL_PROMPT=0` in
base Dockerfile `ENV`.

### gh auth

`GH_CONFIG_DIR=/home/agent/.pi/agent/gh` persists under `config/pi/gh/`.

```bash
docker compose --profile pi run --rm --entrypoint bash bob-pi -lc 'gh auth login'
```

### Docker socket

Compose mounts `/var/run/docker.sock`; entrypoints fix GID then `gosu` to the
agent user so `docker` / `k3d` work non-root.

## Model cards

| Model | Card recommends |
|-------|-----------------|
| Qwen3.5-4B-NoThink | non-thinking: temp 0.7 / top-p 0.8; ≥128K ctx; multimodal; MTP |
| Qwen3.5-9B-Uncensored-Q4_K_M | thinking: temp 0.6 / top-p 0.95 / top-k 20; ≥128K ctx; multimodal; MTP |
| Qwopus3.5-9B-Coder-MTP-Q4_K_M | temp 1.0 / top-p 0.95 / top-k 20; MTP draft=2; reasoning; multimodal; tool calling |
| Qwythos-9B-Claude-Mythos-uncensored-Q6_K | temp 0.6 / top-p 0.95 / top-k 20 / repeat-penalty 1.05; 1M YaRN; reasoning; multimodal; tool calling |

Keep `temp ≥ 0.6` on reasoning models — greedy/very-low-temp loops.

## Safety guarantees

- Generators only write their generated targets (`config.generated.ini`,
  `config/pi/{models,settings}.json`, `config/opencode/opencode.json`).
- `download` never overwrites locals without `--force`.
- `--verify` reports mismatches without deleting.
- Downloader / pi / opencode are profile-gated; plain compose starts only
  model-server (unless using `./ctl.sh start`, which also starts opencode).
