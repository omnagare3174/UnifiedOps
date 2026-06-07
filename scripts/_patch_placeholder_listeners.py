"""One-shot patcher: adds PRI / category extraction to the 5 remaining
compact placeholder listeners (netapp_bcp/sify, dell_bcp/cdvl/sify).

netapp_cdvl was patched manually because of its slightly different shape.
This script is idempotent - re-running it on an already-patched file is
a no-op."""
from __future__ import annotations

import re
from pathlib import Path

LISTENER_DIR = Path(__file__).resolve().parents[1] / "listener"

TARGETS = [
    ("syslog_trap_listener_netapp_bcp.py",  "netapp_event"),
    ("syslog_trap_listener_netapp_sify.py", "netapp_event"),
    ("syslog_trap_listener_dell_bcp.py",    "dell_event"),
    ("syslog_trap_listener_dell_cdvl.py",   "dell_event"),
    ("syslog_trap_listener_dell_sify.py",   "dell_event"),
]


IMPORT_BLOCK_OLD = "import logging\nimport os\nimport re\nimport socket\nimport threading\nimport time\nfrom datetime import datetime, timezone\nfrom typing import Optional\n"
IMPORT_BLOCK_NEW = (
    "import logging\n"
    "import os\n"
    "import re\n"
    "import socket\n"
    "import sys\n"
    "import threading\n"
    "import time\n"
    "from datetime import datetime, timezone\n"
    "from pathlib import Path\n"
    "from typing import Optional\n"
    "\n"
    "sys.path.insert(0, str(Path(__file__).resolve().parent))\n"
    "from _syslog_helpers import parse_event  # noqa: E402\n"
)


def patch_block(text: str, measurement: str) -> str:
    """Patch the compact _record() Influx writer block."""
    pattern = re.compile(
        r"(    array_name = \w+_IP_MAP\.get\(source_ip, hostname or \"unknown\"\)\n)"
        r"\n"
        r"(    LOG\.info\(\"%d bytes from %s \(%s\) :: %s\", len\(raw\), source_ip, array_name, preview\)\n)"
        r"\n"
        r"    if not _influx_enabled or _write_api is None:\n"
        r"        return\n"
        r"    try:\n"
        r"        point = \(\n"
        r"            Point\(\"" + re.escape(measurement) + r"\"\)\n"
        r"            \.tag\(\"vendor\", VENDOR\)\.tag\(\"location\", LOCATION\)\n"
        r"            \.tag\(\"source_ip\", source_ip\)\.tag\(\"array_name\", array_name\)\n"
        r"            \.field\(\"bytes\", len\(raw\)\)\.field\(\"preview\", preview\)\n"
        r"            \.time\(datetime\.now\(timezone\.utc\), WritePrecision\.NS\)\n"
        r"        \)\n"
    )
    replacement = (
        r"\1    severity, trap_category = parse_event(body)\n"
        "\n"
        '    LOG.info("%d bytes from %s (%s) sev=%s cat=%s :: %s",\n'
        "             len(raw), source_ip, array_name, severity, trap_category, preview)\n"
        "\n"
        "    if not _influx_enabled or _write_api is None:\n"
        "        return\n"
        "    try:\n"
        "        point = (\n"
        f'            Point("{measurement}")\n'
        '            .tag("vendor", VENDOR).tag("location", LOCATION)\n'
        '            .tag("source_ip", source_ip).tag("array_name", array_name)\n'
        '            .tag("severity", severity)\n'
        '            .tag("trap_category", trap_category)\n'
        '            .field("bytes", len(raw)).field("preview", preview)\n'
        '            .field("raw_message", body)\n'
        "            .time(datetime.now(timezone.utc), WritePrecision.NS)\n"
        "        )\n"
    )
    new_text, n = pattern.subn(replacement, text, count=1)
    if n == 0 and "parse_event(body)" not in text:
        raise RuntimeError(f"writer block not matched in {measurement} listener")
    return new_text


def main() -> None:
    for fname, measurement in TARGETS:
        path = LISTENER_DIR / fname
        text = path.read_text(encoding="utf-8")
        if "from _syslog_helpers import parse_event" not in text:
            if IMPORT_BLOCK_OLD not in text:
                raise RuntimeError(f"import block not found in {fname}")
            text = text.replace(IMPORT_BLOCK_OLD, IMPORT_BLOCK_NEW, 1)
        text = patch_block(text, measurement)
        path.write_text(text, encoding="utf-8")
        print(f"patched: {fname}")


if __name__ == "__main__":
    main()
