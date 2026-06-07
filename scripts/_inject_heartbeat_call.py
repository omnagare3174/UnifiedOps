"""Inject `_start_heartbeat()` call into listeners that define the helper
but never call it. Idempotent - skips files that already invoke it."""
from __future__ import annotations
import pathlib
import re
import sys

LISTENER_DIR = pathlib.Path(__file__).resolve().parents[1] / "listener"

# Files known to be missing the invocation.
TARGETS = [
    "syslog_trap_listener_cdvl.py",
    "syslog_trap_listener_bcp.py",
    "syslog_trap_listener_sify.py",
    "syslog_trap_listener_dell_bcp.py",
    "syslog_trap_listener_dell_sify.py",
    "syslog_trap_listener_netapp_sify.py",
]

# Patterns we anchor on (try in order; the first match wins).
ANCHORS = [
    r'^(\s*)log\.info\("=" \* 60\)\s*\n\s*\n(\s*)writer = InfluxWriter\(\)',
    r'^(\s*)LOG\.info\("=" \* 60\)\s*\n\s*\n(\s*)writer = InfluxWriter\(\)',
    r'^(\s*)log\.info\("=" \* 60\)\s*\n\s*\n(\s*)udp = socket\.socket',
    r'^(\s*)LOG\.info\("=" \* 60\)\s*\n\s*\n(\s*)udp = socket\.socket',
]

INJECTION = '\n{indent}_start_heartbeat()\n'

patched = []
skipped = []
failed  = []

for name in TARGETS:
    path = LISTENER_DIR / name
    if not path.exists():
        failed.append(f"{name}: NOT FOUND")
        continue
    src = path.read_text(encoding="utf-8")
    if re.search(r'^\s*_start_heartbeat\s*\(\s*\)', src, flags=re.M):
        skipped.append(f"{name}: already calls _start_heartbeat()")
        continue
    new_src = None
    for pat in ANCHORS:
        m = re.search(pat, src, flags=re.M)
        if m:
            indent = m.group(2)
            insertion = f"{m.group(1)}log.info(\"=\" * 60)" if "log.info" in m.group(0) else f"{m.group(1)}LOG.info(\"=\" * 60)"
            replacement = f"{insertion}\n{indent}_start_heartbeat()\n\n{indent}{m.group(0).split(chr(10))[-1]}"
            new_src = src[:m.start()] + replacement + src[m.end():]
            break
    if new_src is None:
        failed.append(f"{name}: no anchor matched")
        continue
    path.write_text(new_src, encoding="utf-8")
    patched.append(name)

print(f"patched: {len(patched)}")
for n in patched: print(f"  + {n}")
print(f"skipped: {len(skipped)}")
for n in skipped: print(f"  = {n}")
print(f"failed:  {len(failed)}")
for n in failed: print(f"  ! {n}")
sys.exit(0 if not failed else 1)
