#!/usr/bin/env python3
"""Bootstrap the llama.cpp stack from stack.yaml.

Single source of truth lives in `stack.yaml`. This tool:

    bootstrap.py generate-config          -> write a llama-server models-preset INI
    bootstrap.py generate-opencode-config -> write OpenCode opencode.json
    bootstrap.py download                 -> fetch every missing GGUF/mmproj from HF
    bootstrap.py status                   -> print presence/size of every model file

Expected file sizes for verification are looked up from Hugging Face on demand
(when --verify is passed) — no per-file `size:` needs to be recorded in
stack.yaml.

Runnable either on the host (python3 + pyyaml) or inside a sidecar image.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

import yaml


def load_stack(config_path: Path) -> dict:
    with config_path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if "stack" not in data or "models" not in data:
        sys.exit(f"{config_path}: missing top-level 'stack' or 'models'")
    return data


def resolve_host_paths(stack: dict, here: Path,
                       models_dir_override: Path | None = None,
                       config_dir_override: Path | None = None) -> dict:
    """Resolve host-relative paths. YAML uses ./relative; we resolve against
    the directory containing stack.yaml (so the tool works from anywhere).
    CLI overrides let the sidecar point at the container mount layout
    (models at /models, config at /config) regardless of the YAML defaults."""
    s = stack["stack"]
    return {
        "host_models_dir": (models_dir_override if models_dir_override
                            else _resolve(s["host_models_dir"], here)),
        "container_models_dir": s["container_models_dir"].rstrip("/"),
        "host_config_dir": (config_dir_override if config_dir_override
                            else _resolve(s["host_config_dir"], here)),
        "container_config_path": s["container_config_path"],
        "generated_name": s["generated_config_name"],
    }


def _resolve(p: str, here: Path) -> Path:
    pp = Path(p)
    return pp if pp.is_absolute() else (here / pp).resolve()


def _fmt_value(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, dict):
        return json.dumps(v, separators=(",", ":"), ensure_ascii=False)
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        # keep "1.0" style (YAML 1.0 -> float 1.0 -> "1.0"), not "1"
        s = repr(v)
        return s if "." in s or "e" in s or "inf" in s else s + ".0"
    return str(v)


# --------------------------------------------------------------------------
# generate-config
# --------------------------------------------------------------------------
def cmd_generate_config(args) -> int:
    here = args.config.parent.resolve()
    stack = load_stack(args.config)
    paths = resolve_host_paths(stack, here, args.models_dir, args.config_dir)

    out_dir = paths["host_config_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / paths["generated_name"]

    lines: list[str] = []
    for m in stack["models"]:
        lines.append(f"[{m['name']}]")
        files = {f["kind"]: f for f in m["files"]}
        cmdir = paths["container_models_dir"]
        if "model" in files:
            lines.append(f"model = {cmdir}/{m['dir']}/{files['model']['name']}")
        if "mmproj" in files:
            lines.append(f"mmproj = {cmdir}/{m['dir']}/{files['mmproj']['name']}")
        for key, val in m.get("settings", {}).items():
            lines.append(f"{key} = {_fmt_value(val)}")
        lines.append("")  # blank line between entries

    text = "\n".join(lines).rstrip("\n") + "\n"
    out_path.write_text(text, encoding="utf-8")
    print(f"wrote {out_path} ({out_path.stat().st_size} bytes, "
          f"{len(stack['models'])} models)")
    return 0


# --------------------------------------------------------------------------
# generate-opencode-config  (OpenCode agent — https://opencode.ai)
# --------------------------------------------------------------------------
# Maps each stack.yaml model to an OpenCode custom provider entry
# (~/.config/opencode/opencode.json). OpenCode connects to the llama-server's
# OpenAI-compat endpoint; multimodal models (card.multimodal) advertise both
# text and image input. Thinking models set reasoning + interleaved so
# OpenCode surfaces llama.cpp's reasoning_content and replays it on later turns
# (https://opencode.ai/docs/models/, opencode.ai/config.json).
def _opencode_model_entry(m: dict) -> dict:
    entry: dict = {
        "name": m["name"],  # llama-server preset id == stack.yaml name
        "modalities": {
            "input": ["text"],
            "output": ["text"],
        },
    }
    if m.get("card", {}).get("multimodal"):
        entry["modalities"]["input"].append("image")
    if m.get("thinking"):
        # capability flag + field used by @ai-sdk/openai-compatible /
        # llama-server (--reasoning-format deepseek → reasoning_content)
        entry["reasoning"] = True
        entry["interleaved"] = {"field": "reasoning_content"}
    return entry


def cmd_generate_opencode_config(args) -> int:
    here = args.config.parent.resolve()
    stack = load_stack(args.config)
    paths = resolve_host_paths(stack, here, args.models_dir, args.config_dir)
    opencode = stack.get("opencode", {})
    provider_key = opencode.get("provider", "llama-server")
    base_url = opencode.get("base_url", "http://model-server:6060/v1")
    api_key_env = opencode.get("api_key_env", "")
    server = opencode.get("server", {"port": 8008, "hostname": "0.0.0.0"})

    known_names = [m["name"] for m in stack["models"]]
    default_model = opencode.get("default_model")
    if default_model and default_model not in known_names:
        sys.exit(f"opencode.default_model '{default_model}' is not a model name "
                 f"in stack.yaml (known: {known_names})")
    if not default_model and known_names:
        default_model = known_names[0]

    out_dir = paths["host_config_dir"] / "opencode"
    out_dir.mkdir(parents=True, exist_ok=True)

    provider_cfg: dict = {
        "name": provider_key,
        "npm": "@ai-sdk/openai-compatible",
        "options": {"baseURL": base_url},
        "models": {m["name"]: _opencode_model_entry(m)
                   for m in stack["models"]},
    }
    if api_key_env:
        provider_cfg["options"]["apiKey"] = f"{{env:{api_key_env}}}"

    opencode_json: dict = {
        "$schema": "https://opencode.ai/config.json",
        "model": f"{provider_key}/{default_model}",
        "small_model": f"{provider_key}/{default_model}",
        "server": server,
        "provider": {provider_key: provider_cfg},
        "mcp": {
            "browsermcp": {
                "type": "local",
                "command": ["npx", "@browsermcp/mcp@latest"],
                "enabled": True,
            }
        },
    }
    with (out_dir / "opencode.json").open("w", encoding="utf-8") as fh:
        json.dump(opencode_json, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(f"wrote {out_dir/'opencode.json'} ({len(stack['models'])} models, "
          f"provider={provider_key}, base_url={base_url}, "
          f"default={default_model})")
    return 0


# --------------------------------------------------------------------------
# download
# --------------------------------------------------------------------------
def _hf_headers(stack: dict) -> dict:
    headers = {"User-Agent": "bob-bootstrap/1.0"}
    tok_env = stack.get("huggingface", {}).get("token_env", "HF_TOKEN")
    tok = os.environ.get(tok_env, "")
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    return headers


def _file_local_name(f: dict) -> str:
    return f["name"]


def _file_remote_name(f: dict) -> str:
    return f.get("remote") or f["name"]


def _file_target(host_models_dir: Path, model: dict, f: dict) -> Path:
    return host_models_dir / model["dir"] / _file_local_name(f)


_HF_TREE_CACHE: dict[str, dict[str, int]] = {}


def _hf_tree_sizes(repo: str, base: str, headers: dict) -> dict[str, int]:
    """Return {file_path: bytes} for every file in <repo>/tree/main via the HF
    API. Cached per repo for the process lifetime. Returns {} on failure."""
    if repo in _HF_TREE_CACHE:
        return _HF_TREE_CACHE[repo]
    url = f"{base}/api/models/{repo}/tree/main"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            entries = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"  (HF size lookup failed for {repo}: {e})", file=sys.stderr)
        _HF_TREE_CACHE[repo] = {}
        return {}
    sizes = {e["path"]: int(e["size"]) for e in entries
             if e.get("type") == "file" and "size" in e}
    _HF_TREE_CACHE[repo] = sizes
    return sizes


def _hf_expected_size(repo: str, remote: str, base: str,
                     headers: dict) -> int | None:
    return _hf_tree_sizes(repo, base, headers).get(remote)


def _download_one(url: str, target: Path, headers: dict, expected: int | None,
                  force: bool, verify: bool) -> tuple[bool, str]:
    """Return (ok, message). Resumable via HTTP Range."""
    target.parent.mkdir(parents=True, exist_ok=True)
    existing = target.stat().st_size if target.exists() else 0

    if target.exists() and not force:
        status = "exists"
        if verify and expected is not None and existing != expected:
            status = (f"exists (size {existing} != expected {expected}; "
                      "leaving file, remove it to re-download)")
        return True, f"{status}: {target}"

    # resumable: keep partial bytes, request Range from there
    mode = "ab" if target.exists() else "wb"
    start = existing if mode == "ab" else 0
    req_headers = dict(headers)
    if mode == "ab" and start > 0:
        req_headers["Range"] = f"bytes={start}-"

    req = urllib.request.Request(url, headers=req_headers)
    try:
        resp = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code} fetching {url}"
    except Exception as e:  # noqa: BLE001
        return False, f"error fetching {url}: {e}"

    total = int(resp.headers.get("Content-Length") or 0)
    if resp.status == 206:
        # partial content: 'total' is remaining bytes
        total = start + total
    elif mode == "ab" and start > 0:
        # server ignored Range -> restart from scratch
        mode = "wb"
        start = 0

    with target.open(mode) as fh:
        last = 0
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            fh.write(chunk)
            start += len(chunk)
            now = time.time()
            if now - last > 2.0:
                pct = f"{start}/{total} ({100*start/total:.1f}%)" if total else f"{start} bytes"
                print(f"  {pct:<22} {target.name}", end="\r")
                last = now
    print(f"  downloaded {start} bytes -> {target.name}             ")
    resp.close()

    got = target.stat().st_size
    if expected is not None and got != expected:
        return (verify is False), (f"downloaded {got} != expected {expected} "
                                   "(kept; verify disabled so treated as ok)")
    return True, f"downloaded {got} bytes -> {target}"


def cmd_download(args) -> int:
    here = args.config.parent.resolve()
    stack = load_stack(args.config)
    paths = resolve_host_paths(stack, here, args.models_dir, args.config_dir)
    host_models_dir = paths["host_models_dir"]
    base = stack["huggingface"]["base_url"].rstrip("/")
    headers = _hf_headers(stack)

    host_models_dir.mkdir(parents=True, exist_ok=True)
    selected = _select(stack, args.only)
    ok_all = True
    for m in selected:
        print(f"\n== {m['name']}  ({m['repo']})")
        # Only hit HF for sizes when verifying; without --verify there is no
        # expected-size check, so no operator-supplied sizes are required.
        tree = _hf_tree_sizes(m["repo"], base, headers) if args.verify else {}
        for f in m["files"]:
            remote = _file_remote_name(f)
            url = f"{base}/{m['repo']}/resolve/main/{remote}"
            target = _file_target(host_models_dir, m, f)
            expected = tree.get(remote) if args.verify else None
            ok, msg = _download_one(url, target, headers, expected,
                                    args.force, args.verify)
            ok_all = ok_all and ok
            print(("  OK  " if ok else "  FAIL ") + msg)
    return 0 if ok_all else 1


# --------------------------------------------------------------------------
# status
# --------------------------------------------------------------------------
def cmd_status(args) -> int:
    here = args.config.parent.resolve()
    stack = load_stack(args.config)
    paths = resolve_host_paths(stack, here, args.models_dir, args.config_dir)
    host_models_dir = paths["host_models_dir"]
    base = stack["huggingface"]["base_url"].rstrip("/")
    headers = _hf_headers(stack)
    verify = args.verify

    print(f"{'name':<42} {'file':<70} {'present':>7} {'local':>14}"
          + (f" {'expected':>14} match" if verify else ""))
    print("-" * (132 if verify else 104))
    for m in _select(stack, args.only):
        tree = _hf_tree_sizes(m["repo"], base, headers) if verify else {}
        for f in m["files"]:
            target = _file_target(host_models_dir, m, f)
            present = target.exists()
            local = target.stat().st_size if present else 0
            row = (f"{m['name'][:42]:<42} {target.name[:70]:<70} "
                   f"{'yes' if present else 'NO':>7} {local:>14}")
            if verify:
                exp = tree.get(_file_remote_name(f)) or 0
                match = ("Y" if present and local == exp
                         else ("N" if present else "-"))
                row += f" {exp:>14} {match}"
            print(row)
    return 0


def _select(stack: dict, only: list[str] | None) -> list[dict]:
    if not only:
        return stack["models"]
    return [m for m in stack["models"] if m["name"] in only]


# --------------------------------------------------------------------------
def main(argv=None) -> int:
    here = Path(__file__).resolve().parent.parent
    default_cfg = here / "stack.yaml"
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", type=Path, default=default_cfg,
                   help="path to stack.yaml (default: ./stack.yaml)")
    p.add_argument("--models-dir", type=Path, default=None,
                   help="override host_models_dir (e.g. /models in the sidecar)")
    p.add_argument("--config-dir", type=Path, default=None,
                   help="override host_config_dir (e.g. /config in the sidecar)")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate-config",
                       help="write config/config.generated.ini (the preset "
                            "the llama-server mounts)")
    g.set_defaults(func=cmd_generate_config)

    og = sub.add_parser("generate-opencode-config",
                        help="write config/opencode/opencode.json for the "
                             "OpenCode agent from the model roster in stack.yaml")
    og.set_defaults(func=cmd_generate_opencode_config)

    d = sub.add_parser("download", help="fetch missing model files from HF")
    d.add_argument("--force", action="store_true",
                   help="re-download even if the local file exists")
    d.add_argument("--verify", action="store_true",
                   help="check on-disk size against Hugging Face (fetch the HF "
                        "file listing); fail the run on a mismatch")
    d.add_argument("--only", action="append", metavar="SECTION",
                   help="restrict to one or more model names (repeatable)")
    d.set_defaults(func=cmd_download)

    s = sub.add_parser("status", help="print presence/size of every file")
    s.add_argument("--verify", action="store_true",
                   help="fetch Hugging Face sizes and show expected/match "
                        "columns (requires network)")
    s.add_argument("--only", action="append", metavar="SECTION")
    s.set_defaults(func=cmd_status)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())