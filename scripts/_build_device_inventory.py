"""Generate server/data/device_inventory.json from the listener IP maps.

Each listener (Hitachi/Brocade/NetApp/Dell at each site) defines its own
IP -> array_name (or switch_name) map. This one-shot tool extracts those
literal dicts via `ast` and produces a single JSON file the backend can
load at startup.

Run from the repo root:
    .venv\\Scripts\\python.exe scripts\\_build_device_inventory.py

NetApp / Dell listeners ship with placeholder empty maps; we fall back
to the dev trap_sender catalogue so the OEM cards aren't permanently
"0 / 0" in the lab.
"""
from __future__ import annotations

import ast
import json
import sys
from pathlib import Path
from typing import Dict

REPO = Path(__file__).resolve().parents[1]
LISTENER_DIR = REPO / "listener"
DEV_DIR      = REPO / "dev"
OUT_PATH     = REPO / "server" / "data" / "device_inventory.json"


# (vendor, site, file, dict-name)
LISTENER_TARGETS = [
    ("hitachi", "CDVL", "syslog_trap_listener_cdvl.py",         "IP_TO_STORAGE_NAME"),
    ("hitachi", "BCP",  "syslog_trap_listener_bcp.py",          "IP_TO_STORAGE_NAME"),
    ("hitachi", "SIFY", "syslog_trap_listener_sify.py",         "IP_TO_STORAGE_NAME"),
    ("brocade", "PAIR_CDVL_SIFY", "syslog_trap_listener_cdvl_n_sify.py", "SWITCH_IP_TO_NAME"),
    ("brocade", "PAIR_BCP_UAT",   "syslog_trap_listener_bcp_n_uat.py",   "SWITCH_IP_TO_NAME"),
    ("netapp",  "CDVL", "syslog_trap_listener_netapp_cdvl.py",  "NETAPP_IP_MAP"),
    ("netapp",  "BCP",  "syslog_trap_listener_netapp_bcp.py",   "NETAPP_IP_MAP"),
    ("netapp",  "SIFY", "syslog_trap_listener_netapp_sify.py",  "NETAPP_IP_MAP"),
    ("dell",    "CDVL", "syslog_trap_listener_dell_cdvl.py",    "DELL_IP_MAP"),
    ("dell",    "BCP",  "syslog_trap_listener_dell_bcp.py",     "DELL_IP_MAP"),
    ("dell",    "SIFY", "syslog_trap_listener_dell_sify.py",    "DELL_IP_MAP"),
]


# Brocade switch -> site mapping lives in `SWITCH_INFO` in the same
# listener file. We also need that so we can split the location-pair
# listener's combined switch list into CDVL vs SIFY (or BCP vs UAT).
BROCADE_PAIR_FILES = {
    "PAIR_CDVL_SIFY": "syslog_trap_listener_cdvl_n_sify.py",
    "PAIR_BCP_UAT":   "syslog_trap_listener_bcp_n_uat.py",
}


def extract_dict_literal(file_path: Path, var_name: str) -> dict:
    """Parse a python file and return the literal dict assigned to `var_name`."""
    tree = ast.parse(file_path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == var_name:
                    try:
                        return ast.literal_eval(node.value)
                    except Exception:
                        return {}
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and node.target.id == var_name:
                if node.value is None:
                    continue
                try:
                    return ast.literal_eval(node.value)
                except Exception:
                    return {}
    return {}


def extract_switch_info(file_path: Path) -> Dict[str, dict]:
    """Pull the SWITCH_INFO dict literal: switch_name -> (site, owner, model)."""
    out: Dict[str, dict] = {}
    tree = ast.parse(file_path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        target_name = None
        value_node = None
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == "SWITCH_INFO":
                    target_name, value_node = t.id, node.value
                    break
        elif isinstance(node, ast.AnnAssign):
            if (isinstance(node.target, ast.Name)
                    and node.target.id == "SWITCH_INFO"
                    and node.value is not None):
                target_name, value_node = node.target.id, node.value
        if not target_name or not isinstance(value_node, ast.Dict):
            continue
        for k_node, v_node in zip(value_node.keys, value_node.values):
            try:
                k = ast.literal_eval(k_node)
                v = ast.literal_eval(v_node)
            except Exception:
                continue
            if isinstance(v, tuple) and len(v) >= 1:
                out[k] = {"site": v[0], "owner": v[1] if len(v) > 1 else "",
                          "model": v[2] if len(v) > 2 else ""}
            elif isinstance(v, dict):
                out[k] = v
    return out


def main() -> int:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    inventory: Dict[str, Dict[str, list]] = {
        "hitachi": {"CDVL": [], "BCP": [], "SIFY": []},
        "brocade": {"CDVL": [], "BCP": [], "SIFY": [], "UAT": []},
        "netapp":  {"CDVL": [], "BCP": [], "SIFY": []},
        "dell":    {"CDVL": [], "BCP": [], "SIFY": []},
    }

    # ---- direct vendor x site IP maps ---------------------------------
    for vendor, site, fname, varname in LISTENER_TARGETS:
        if site.startswith("PAIR_"):
            continue
        path = LISTENER_DIR / fname
        if not path.exists():
            print(f"  WARN: {fname} not found")
            continue
        ip_map = extract_dict_literal(path, varname)
        unique = sorted({v for v in ip_map.values()
                         if v and v != "unknown"
                         and not isinstance(v, dict)})
        inventory[vendor][site] = unique
        print(f"  {vendor:<8} {site:<5} {fname:<45} {len(ip_map):>3} ips -> {len(unique):>2} devices")

    # ---- brocade location-pair listeners --------------------------------
    # Each pair listener tags every switch with its real `site` via
    # SWITCH_INFO. Split the combined SWITCH_IP_TO_NAME into per-site
    # buckets so the OEM card can show e.g. CDVL devices and SIFY
    # devices separately even though they share an Influx pipeline.
    for pair_key, fname in BROCADE_PAIR_FILES.items():
        path = LISTENER_DIR / fname
        if not path.exists():
            print(f"  WARN: {fname} not found")
            continue
        ip_map      = extract_dict_literal(path, "SWITCH_IP_TO_NAME")
        switch_info = extract_switch_info(path)
        per_site: Dict[str, set] = {}
        unmatched = 0
        for ip, swname in ip_map.items():
            info = switch_info.get(swname.upper()) if isinstance(swname, str) else None
            if not info:
                unmatched += 1
                continue
            site = info.get("site", "").upper()
            per_site.setdefault(site, set()).add(swname)
        for site, names in per_site.items():
            if site in inventory["brocade"]:
                inventory["brocade"][site] = sorted(names)
        print(f"  brocade  {pair_key:<14} {fname:<45} {len(ip_map):>3} ips -> "
              f"{sum(len(v) for v in per_site.values()):>2} devices (across "
              f"{', '.join(per_site.keys())}{' / ' + str(unmatched) + ' unmapped' if unmatched else ''})")

    # ---- NetApp / Dell fallback from trap_sender catalogue ------------
    # The placeholder NetApp/Dell listeners ship with empty IP_FILTER
    # maps. Until real inventory is curated, fall back to the dev
    # trap_sender's VENDOR_STORAGE_IPS so the OEM card isn't always 0.
    trap_path = DEV_DIR / "trap_sender.py"
    if trap_path.exists():
        ts_map = extract_dict_literal(trap_path, "VENDOR_STORAGE_IPS")
        for vendor_key, label in (("NetApp", "netapp"), ("Dell", "dell")):
            vendor_pool = ts_map.get(vendor_key, {}) if isinstance(ts_map, dict) else {}
            for site, ips in (vendor_pool.items() if isinstance(vendor_pool, dict) else []):
                if site not in inventory[label]:
                    continue
                if inventory[label][site]:
                    continue  # listener already has real entries
                unique = sorted({v for v in ips.values()
                                 if v and v != "unknown"})
                inventory[label][site] = unique
                if unique:
                    print(f"  {label:<8} {site:<5} (trap_sender fallback)               "
                          f"     -> {len(unique):>2} devices")

    # ---- compute summary ------------------------------------------------
    summary = {}
    for vendor, sites in inventory.items():
        total = sum(len(d) for d in sites.values())
        summary[vendor] = total
    print()
    print("summary (unique devices per vendor):")
    for v, n in summary.items():
        print(f"  {v:<8} {n}")

    OUT_PATH.write_text(
        json.dumps({"inventory": inventory, "summary": summary}, indent=2),
        encoding="utf-8",
    )
    print()
    print(f"wrote {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
