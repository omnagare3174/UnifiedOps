"""One-shot: print Python dict literals of every device known to each
listener, ready to paste into dev/trap_sender.py.

For Hitachi (cdvl/bcp/sify) we emit the listener's full IP_TO_STORAGE_NAME.

For Brocade we split the location-pair listeners' SWITCH_IP_TO_NAME by
the per-switch site recorded in SWITCH_INFO, so the trap-sender ends up
with proper { CDVL, SIFY, BCP, UAT } sub-dicts.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path
from typing import Dict, Tuple

LISTENER = Path(__file__).resolve().parents[1] / "listener"


def read_dict(path: Path, name: str) -> dict:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == name:
                    try:
                        return ast.literal_eval(node.value)
                    except Exception:
                        pass
        elif isinstance(node, ast.AnnAssign):
            if (isinstance(node.target, ast.Name) and node.target.id == name
                    and node.value is not None):
                try:
                    return ast.literal_eval(node.value)
                except Exception:
                    pass
    return {}


def read_switch_info(path: Path) -> Dict[str, Tuple[str, str, str]]:
    out: Dict[str, Tuple[str, str, str]] = {}
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        target = None; value = None
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == "SWITCH_INFO":
                    target, value = t.id, node.value; break
        elif isinstance(node, ast.AnnAssign):
            if (isinstance(node.target, ast.Name)
                    and node.target.id == "SWITCH_INFO"
                    and node.value is not None):
                target, value = node.target.id, node.value
        if not target or not isinstance(value, ast.Dict):
            continue
        for k, v in zip(value.keys, value.values):
            try:
                key = ast.literal_eval(k); val = ast.literal_eval(v)
            except Exception:
                continue
            if isinstance(val, tuple) and len(val) >= 1:
                out[key] = (val[0],
                            val[1] if len(val) > 1 else "",
                            val[2] if len(val) > 2 else "")
    return out


def emit_dict(label: str, m: Dict[str, str]) -> None:
    print(f"# ---- {label} ({len(m)} ips -> {len(set(m.values()))} unique) ----")
    for ip in sorted(m.keys(), key=lambda x: tuple(int(p) if p.isdigit() else 0
                                                    for p in x.split('.'))):
        print(f'    "{ip:<15}": "{m[ip]}",')
    print()


# ---------------------------------------------------------------------- Hitachi
print("=" * 78)
print("HITACHI - paste each into LOCATION_IP_MAP")
print("=" * 78)
for site, fname in [("CDVL", "syslog_trap_listener_cdvl.py"),
                     ("BCP",  "syslog_trap_listener_bcp.py"),
                     ("SIFY", "syslog_trap_listener_sify.py")]:
    ipmap = read_dict(LISTENER / fname, "IP_TO_STORAGE_NAME")
    emit_dict(f"Hitachi {site}", ipmap)


# ---------------------------------------------------------------------- Brocade
print("=" * 78)
print("BROCADE - paste each into VENDOR_STORAGE_IPS['Brocade']")
print("=" * 78)
for pair_label, fname, sites in [
    ("CDVL/SIFY pair", "syslog_trap_listener_cdvl_n_sify.py", {"CDVL", "SIFY"}),
    ("BCP/UAT pair",   "syslog_trap_listener_bcp_n_uat.py",   {"BCP", "UAT"}),
]:
    path = LISTENER / fname
    ipmap = read_dict(path, "SWITCH_IP_TO_NAME")
    info  = read_switch_info(path)

    per_site: Dict[str, Dict[str, str]] = {s: {} for s in sites}
    unknown = {}
    for ip, swname in ipmap.items():
        meta = info.get((swname or "").upper())
        if meta and meta[0] in sites:
            per_site[meta[0]][ip] = swname
        else:
            unknown[ip] = swname

    for site in sorted(sites):
        emit_dict(f"Brocade {site} (from {pair_label})", per_site[site])
    if unknown:
        print(f"# UNMAPPED switches from {pair_label} (site unknown in SWITCH_INFO):")
        for ip in sorted(unknown):
            print(f'#     "{ip}": "{unknown[ip]}",')
        print()

sys.exit(0)
