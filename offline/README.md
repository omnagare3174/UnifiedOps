# `offline/` — airgapped install assets

The UnifiedOps target VMs run in an airgapped network. Everything Python
and Node needs to install must be staged on a connected machine **first**,
then carried in via the production zip.

## Contents

| Path                          | What it contains                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pip-wheels-linux-py39/`      | Pre-downloaded **manylinux** wheels for the production RHEL 8 VM (Python 3.9, cp39, x86_64).              |
| `pip-wheels-win/`             | Same dep set for Windows dev convenience (not shipped to production).                                     |

Frontend deployment does **not** require `node_modules` on the target —
the React + Vite bundle is pre-built during pack-time (`scripts/pack.ps1`)
and served as static files by FastAPI. Node.js is therefore not a
production dependency.

## Refreshing the Linux wheel cache

Run on the same OS family as the target (any Linux machine with internet
access works; we usually do this from a CDVL bastion):

```bash
python3.9 -m pip download \
  -r server/requirements.txt \
  -d offline/pip-wheels-linux-py39 \
  --platform manylinux2014_x86_64 \
  --python-version 39 \
  --implementation cp \
  --abi cp39 \
  --only-binary=:all:
```

On a Windows dev box the equivalent PowerShell incantation:

```powershell
.\.venv\Scripts\python.exe -m pip download `
  -r server\requirements.txt `
  -d offline\pip-wheels-linux-py39 `
  --platform manylinux2014_x86_64 `
  --python-version 39 `
  --implementation cp `
  --abi cp39 `
  --only-binary=:all:
```

## Installing on the airgapped target

After unpacking the production zip on the UI VM:

```bash
cd /opt/unifiedops
python3.9 -m venv .venv
source .venv/bin/activate
pip install \
  --no-index \
  --find-links offline/pip-wheels \
  -r requirements.txt
```

(`offline/pip-wheels` is the in-zip name; the pack script renames
`pip-wheels-linux-py39` to that on the way out.)
