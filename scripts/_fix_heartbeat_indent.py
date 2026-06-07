"""Fix double-indented line that my previous patch broke. The injection
mangled the indentation of the line immediately after `_start_heartbeat()`."""
from __future__ import annotations
import pathlib
import re
import sys

LISTENER_DIR = pathlib.Path(__file__).resolve().parents[1] / "listener"

TARGETS = [
    "syslog_trap_listener_cdvl.py",
    "syslog_trap_listener_bcp.py",
    "syslog_trap_listener_sify.py",
    "syslog_trap_listener_dell_bcp.py",
    "syslog_trap_listener_dell_sify.py",
    "syslog_trap_listener_netapp_sify.py",
]

PAT = re.compile(r'(\n\s*_start_heartbeat\(\)\s*\n\s*\n)(\s+)(\S.*)', re.M)

def fix_one(path: pathlib.Path) -> str | None:
    src = path.read_text(encoding="utf-8")
    m = PAT.search(src)
    if not m:
        return None
    bad_indent = m.group(2)
    body       = m.group(3)
    if bad_indent == "    ":
        return "already 4-space"
    if not bad_indent.startswith("    "):
        return f"weird indent: {bad_indent!r}"
    new_indent = "    "
    new_src = src[:m.start(2)] + new_indent + body + src[m.end(3):]
    path.write_text(new_src, encoding="utf-8")
    return f"fixed (was {len(bad_indent)} spaces, now 4)"

for name in TARGETS:
    p = LISTENER_DIR / name
    if not p.exists():
        print(f"  ! {name}: missing")
        continue
    result = fix_one(p)
    print(f"  + {name}: {result}")
