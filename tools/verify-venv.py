#!/usr/bin/env python3
"""Verify the Semgrep venv (.tools/semgrep-venv) file by file against the hash lock.

The venv's own RECORD files are never read: they are written by the installer
inside the venv, so they would attest to themselves (verifier m19, T5). Every
file and symlink in the venv must be accounted for by exactly one of these
classes, and the set of files must equal the recorded manifest:

  W  wheel member: the file's sha256 equals the member of the pinned wheel.
     Each wheel is kept in .tools/semgrep-wheels/ (outside the venv), and on
     every run its own sha256 must be one of the hashes that
     tools/semgrep/requirements.txt lists for its pin. So these hashes come
     from the lock, wheel by wheel.
  S  console script in bin/: rebuilt byte for byte from the wheel's
     entry_points.txt (itself W) and the venv path.
  P  pinned below by hash: pyvenv.cfg (also parsed: include-system-site-packages
     must be false and home must be /usr/bin), uv's _virtualenv.pth/.py and the
     venv's .gitignore, CACHEDIR.TAG and .lock. Derived on 2026-10-06 by creating
     a fresh venv with the verified uv 0.12.19 and /usr/bin/python3 3.14.4.
  L  symlinks: bin/python -> /usr/bin/python3, bin/python3 and bin/python3.X ->
     python, lib64 -> lib.
  M  installer metadata, never executed: *.dist-info/{RECORD, INSTALLER,
     REQUESTED, direct_url.json, uv_cache.json} and the activate scripts that CI
     never runs. These are checked against the manifest only.

The manifest (.tools/semgrep-venv.manifest.json, outside the venv) lists every
entry's class and sha256 (or link target). `record` writes it at install time
and refuses unless every W, S, P and L check already passes. `verify` requires
the venv tree to equal the manifest exactly (no missing, extra or changed
entry) AND re-derives every W, S and P hash independently. So editing the
manifest together with a venv file still fails, except for class M.

Also checked: the installed distributions (name==version) are exactly the lock
pins, there is exactly one lock-verified wheel per pin, the lock is unchanged
since the manifest was recorded, and semgrep-core has the hash derived from the
PyPI wheel semgrep-1.178.0 (sha256 b7c4a4ba…41f2). `__pycache__` is deleted
first (Python checks .pyc by timestamp, not hash). CI runs Semgrep with
PYTHONDONTWRITEBYTECODE=1.

Not covered: the system Python (/usr/bin/python3, OS package manager). Class M
files are anchored only to the manifest, which a writer of .tools can rewrite.

Usage:
  python3 tools/verify-venv.py fetch  <venv> <requirements.txt> <wheels-dir>
      (network: pypi.org JSON API and files.pythonhosted.org only)
  python3 tools/verify-venv.py record <venv> <requirements.txt> <wheels-dir> <manifest>
  python3 tools/verify-venv.py verify <venv> <requirements.txt> <wheels-dir> <manifest>
"""
import configparser
import hashlib
import json
import os
import re
import shutil
import sys
import urllib.request
import zipfile

SEMGREP_CORE_SHA256 = "83223753cbd6495b93e890058e7a41cc6b634f42dc75d2d5dc76ba3687a3eca4"
PINNED = {
    "pyvenv.cfg": "295c0c0044e944cf935bc2e99508ed0e329afeaf385e6d5a269826f1d442e72e",
    ".gitignore": "684888c0ebb17f374298b65ee2807526c066094c701bcc7ebbe1c1095f494fc1",
    "CACHEDIR.TAG": "5953156d7e0c564a427251316eaf26f8870e6483ae2197f916b630e4f93e31ae",
    ".lock": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "SITE/_virtualenv.pth": "69ac3d8f27e679c81b94ab30b3b56e9cd138219b1ba94a1fa3606d5a76a1433d",
    "SITE/_virtualenv.py": "cfb3db86aaa53bb62b5ff764970bec2d71c9228590a0ebec57f6ec926cc0bf1a",
}
LINKS = {"bin/python": "/usr/bin/python3", "bin/python3": "python", "lib64": "lib"}
M_DISTINFO = {"RECORD", "INSTALLER", "REQUESTED", "direct_url.json", "uv_cache.json"}
M_BIN = re.compile(r"^bin/(activate(\.[a-z0-9]+)?|activate_this\.py|deactivate\.bat|pydoc\.bat)$")
SCRIPT = (
    "#!{python}\n# -*- coding: utf-8 -*-\nimport sys\nfrom {module} import {head}\n"
    "if __name__ == \"__main__\":\n"
    "    if sys.argv[0].endswith(\"-script.pyw\"):\n        sys.argv[0] = sys.argv[0][:-11]\n"
    "    elif sys.argv[0].endswith(\".exe\"):\n        sys.argv[0] = sys.argv[0][:-4]\n"
    "    sys.exit({call}())\n"
)
CLASS_NAME = {"W": "the lock-verified wheel", "S": "the entry point", "P": "the pinned value"}


def norm(name):
    return re.sub(r"[-_.]+", "-", name).lower()


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_lock(lock):
    """{normalized name: (version, {sha256, ...})} from a --require-hashes lock."""
    pins, cur = {}, None
    with open(lock, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^([A-Za-z0-9][A-Za-z0-9._-]*)==([^\s;\\]+)", line)
            if m:
                cur = norm(m.group(1))
                pins[cur] = (m.group(2), set())
            for h in re.findall(r"--hash=sha256:([0-9a-f]{64})", line):
                if cur is None:
                    raise SystemExit(f"FAIL: hash before any pin in {lock}")
                pins[cur][1].add(h)
    return pins


def layout(venv):
    libs = [d for d in os.listdir(os.path.join(venv, "lib")) if d.startswith("python")]
    if len(libs) != 1:
        raise SystemExit(f"FAIL: expected one lib/python* dir, found {libs}")
    return libs[0], f"lib/{libs[0]}/site-packages"


def installed_dists(venv, site):
    out = {}
    for d in os.listdir(os.path.join(venv, site)):
        if d.endswith(".dist-info"):
            name, _, version = d[: -len(".dist-info")].rpartition("-")
            out[norm(name)] = (version, d)
    return out


def wheel_tags(filename):
    parts = filename[: -len(".whl")].split("-")
    py, abi, plat = parts[-3], parts[-2], parts[-1]
    return {f"{a}-{b}-{c}" for a in py.split(".") for b in abi.split(".") for c in plat.split(".")}


def fetch(venv, lock, wheels):
    """Download, for each pin, the one lock-hashed wheel whose tags equal the installed WHEEL tags."""
    pins = read_lock(lock)
    _, site = layout(venv)
    dists = installed_dists(venv, site)
    os.makedirs(wheels, exist_ok=True)
    problems = []
    for name, (version, hashes) in sorted(pins.items()):
        if name not in dists:
            problems.append(f"{name}: pinned but not installed")
            continue
        with open(os.path.join(venv, site, dists[name][1], "WHEEL"), encoding="utf-8") as f:
            tags = {line.split(":", 1)[1].strip() for line in f if line.startswith("Tag:")}
        with urllib.request.urlopen(f"https://pypi.org/pypi/{name}/{version}/json", timeout=60) as r:
            files = json.load(r)["urls"]
        cands = [u for u in files if u["filename"].endswith(".whl") and u["digests"]["sha256"] in hashes and wheel_tags(u["filename"]) == tags]
        if len(cands) != 1:
            problems.append(f"{name}=={version}: {len(cands)} lock-hashed wheels match the installed tags {sorted(tags)}")
            continue
        u = cands[0]
        if not u["url"].startswith("https://files.pythonhosted.org/"):
            problems.append(f"{name}: unexpected wheel host {u['url']}")
            continue
        dest = os.path.join(wheels, u["filename"])
        if not (os.path.isfile(dest) and sha256_file(dest) == u["digests"]["sha256"]):
            with urllib.request.urlopen(u["url"], timeout=300) as r, open(dest + ".part", "wb") as out:
                shutil.copyfileobj(r, out)
            os.replace(dest + ".part", dest)
        if sha256_file(dest) not in hashes:
            problems.append(f"{u['filename']}: sha256 is not in the lock")
    return problems


def expected(venv, lock, wheels, venv_path):
    """Independently derived {relpath: (class, sha256)} for W, S and P, plus problems."""
    problems = []
    pins = read_lock(lock)
    libdir, site = layout(venv)
    dists = installed_dists(venv, site)
    if {k: v[0] for k, v in dists.items()} != {k: v[0] for k, v in pins.items()}:
        missing = sorted(set(pins) - set(dists))
        extra = sorted(set(dists) - set(pins))
        wrong = sorted(k for k in set(pins) & set(dists) if pins[k][0] != dists[k][0])
        problems.append(f"installed set differs from the lock: missing {missing}, extra {extra}, wrong version {wrong}")
    exp = {}
    seen = set()
    listing = sorted(os.listdir(wheels)) if os.path.isdir(wheels) else []
    whls = [f for f in listing if f.endswith(".whl")]
    if listing != whls:
        problems.append(f"{wheels} holds files other than wheels")
    python = f"{venv_path}/bin/python"
    for whl in whls:
        name, version = norm(whl.split("-")[0]), whl.split("-")[1]
        if name not in pins or pins[name][0] != version:
            problems.append(f"wheel {whl} is not a lock pin")
            continue
        if name in seen:
            problems.append(f"more than one wheel for {name}")
        seen.add(name)
        if sha256_file(os.path.join(wheels, whl)) not in pins[name][1]:
            problems.append(f"wheel {whl}: sha256 is not in the lock")
            continue
        with zipfile.ZipFile(os.path.join(wheels, whl)) as z:
            for info in z.infolist():
                m = info.filename
                if m.endswith("/"):
                    continue
                data = z.read(info)
                top, _, below = m.partition("/")
                if top.endswith(".dist-info") and below in M_DISTINFO:
                    continue  # rewritten by the installer: class M
                if top.endswith(".data"):
                    kind, _, rest = below.partition("/")
                    if kind in ("purelib", "platlib"):
                        exp[f"{site}/{rest}"] = ("W", sha256_bytes(data))
                    elif kind == "scripts":
                        if data.startswith(b"#!python"):
                            data = b"#!" + python.encode() + data[len(b"#!python"):]
                        exp[f"bin/{rest}"] = ("W", sha256_bytes(data))
                    else:
                        problems.append(f"{whl}: unsupported wheel data dir {kind}")
                    continue
                exp[f"{site}/{m}"] = ("W", sha256_bytes(data))
                if top.endswith(".dist-info") and below == "entry_points.txt":
                    cp = configparser.ConfigParser(delimiters=("=",), interpolation=None)
                    cp.optionxform = str
                    cp.read_string(data.decode("utf-8"))
                    for section in ("console_scripts", "gui_scripts"):
                        for script, target in cp.items(section) if cp.has_section(section) else []:
                            module, _, attr = re.sub(r"\s*\[.*\]\s*$", "", target).strip().partition(":")
                            body = SCRIPT.format(python=python, module=module.strip(), head=attr.strip().split(".")[0], call=attr.strip())
                            exp[f"bin/{script.strip()}"] = ("S", sha256_bytes(body.encode()))
    for k in sorted(set(pins) - seen):
        problems.append(f"no lock-verified wheel for {k} in {wheels}")
    for rel, h in PINNED.items():
        exp[rel.replace("SITE", site)] = ("P", h)
    try:
        with open(os.path.join(venv, "pyvenv.cfg"), encoding="utf-8") as f:
            cfg = dict(line.split(" = ", 1) for line in f.read().splitlines() if " = " in line)
        if cfg.get("include-system-site-packages") != "false" or cfg.get("home") != "/usr/bin":
            problems.append("pyvenv.cfg: include-system-site-packages must be false and home /usr/bin")
    except OSError:
        problems.append("pyvenv.cfg missing")
    return exp, problems, libdir, site


def tree(venv):
    """{relpath: ('f', sha256) | ('l', target)} of every file and symlink in the venv."""
    out = {}
    for dirpath, dirnames, files in os.walk(venv):
        for d in list(dirnames):
            p = os.path.join(dirpath, d)
            if os.path.islink(p):
                out[os.path.relpath(p, venv)] = ("l", os.readlink(p))
                dirnames.remove(d)
        for fn in files:
            p = os.path.join(dirpath, fn)
            out[os.path.relpath(p, venv)] = ("l", os.readlink(p)) if os.path.islink(p) else ("f", sha256_file(p))
    return out


def drop_pycache(venv):
    for dirpath, dirnames, _ in os.walk(venv):
        for d in list(dirnames):
            if d == "__pycache__":
                shutil.rmtree(os.path.join(dirpath, d))
                dirnames.remove(d)


def classify(venv, lock, wheels, venv_path):
    """Check the tree against W/S/P/L/M. Returns (manifest entries, problems)."""
    drop_pycache(venv)
    exp, problems, libdir, site = expected(venv, lock, wheels, venv_path)
    links = dict(LINKS)
    links[f"bin/{libdir}"] = "python"
    entries = {}
    for rel, (kind, val) in sorted(tree(venv).items()):
        if rel in links:
            if kind != "l" or val != links[rel]:
                problems.append(f"{rel} must be a symlink to {links[rel]}")
            entries[rel] = {"class": "L", "target": val}
            continue
        if kind == "l":
            problems.append(f"unexpected symlink {rel} -> {val}")
            continue
        if rel in exp:
            cls, want = exp.pop(rel)
            if val != want:
                problems.append(f"{rel}: sha256 differs from {CLASS_NAME[cls]} (class {cls})")
            entries[rel] = {"class": cls, "sha256": val}
            continue
        parts = rel.split("/")
        if (rel.startswith(site + "/") and len(parts) == 5 and parts[3].endswith(".dist-info") and parts[4] in M_DISTINFO) or M_BIN.match(rel):
            entries[rel] = {"class": "M", "sha256": val}
            continue
        problems.append(f"file not derived from any lock-verified wheel or pin: {rel}")
    for rel in sorted(exp):
        problems.append(f"missing {rel} (class {exp[rel][0]})")
    for rel in links:
        if rel not in entries:
            problems.append(f"missing symlink {rel}")
    if entries.get(f"{site}/semgrep/bin/semgrep-core", {}).get("sha256") != SEMGREP_CORE_SHA256:
        problems.append("semgrep-core hash differs from the one derived from the PyPI wheel")
    return entries, problems


def record(venv, lock, wheels, manifest):
    venv_path = os.path.abspath(venv)
    entries, problems = classify(venv, lock, wheels, venv_path)
    if problems:
        return problems
    doc = {"venv": venv_path, "lock_sha256": sha256_file(lock), "files": entries}
    with open(manifest + ".part", "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, sort_keys=True)
    os.replace(manifest + ".part", manifest)
    print(f"semgrep venv manifest recorded: {len(entries)} entries, sha256 {sha256_file(manifest)}")
    return []


def verify(venv, lock, wheels, manifest):
    try:
        with open(manifest, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, ValueError) as e:
        return [f"manifest unreadable: {manifest}: {e}"]
    problems = []
    if os.path.realpath(doc.get("venv", "")) != os.path.realpath(venv):
        problems.append(f"manifest was recorded for {doc.get('venv')}, not {venv}")
    if doc.get("lock_sha256") != sha256_file(lock):
        problems.append("the lock changed since the manifest was recorded (reinstall the venv)")
    entries, found = classify(venv, lock, wheels, doc.get("venv", os.path.abspath(venv)))
    problems += found
    rec = doc.get("files", {})
    for rel in sorted(set(rec) | set(entries)):
        if rel not in entries:
            problems.append(f"in the manifest but not in the venv: {rel}")
        elif rel not in rec:
            problems.append(f"in the venv but not in the manifest: {rel}")
        elif rec[rel] != entries[rel]:
            problems.append(f"{rel}: differs from the manifest recorded at install time")
    if not problems:
        counts = {}
        for e in entries.values():
            counts[e["class"]] = counts.get(e["class"], 0) + 1
        n = len(read_lock(lock))
        print(f"semgrep venv ok: {n} distributions = lock = {n} lock-verified wheels; "
              f"{len(entries)} entries = manifest ({', '.join(f'{k} {v}' for k, v in sorted(counts.items()))}); "
              f"semgrep-core {SEMGREP_CORE_SHA256[:16]}…")
    return problems


if __name__ == "__main__":
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd == "fetch" and len(args) == 3:
        errs = fetch(*args)
    elif cmd in ("record", "verify") and len(args) == 4:
        errs = (record if cmd == "record" else verify)(*args)
    else:
        print(__doc__)
        sys.exit(2)
    for e in errs:
        print(f"FAIL: {e}")
    sys.exit(1 if errs else 0)
