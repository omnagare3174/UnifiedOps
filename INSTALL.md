# Hi-Track Alert v1.4.1 — Airgapped RHEL 9.4 install (4-server topology)

This release runs across **four** airgapped VMs (RHEL 9.4, Python 3.9):

| Role                | Hostname (example)              | Listens on   | Talks to                       |
|---------------------|---------------------------------|--------------|--------------------------------|
| CDVL pipeline VM    | `cdvl-listener.lan`             | UDP /514     | local Influx :8086             |
| BCP pipeline VM     | `bcp-listener.lan`              | UDP /514     | local Influx :8086             |
| SIFY pipeline VM    | `sify-listener.lan`             | UDP /514     | local Influx :8086             |
| UI VM (operators)   | `hi-track-ui.lan`               | TCP /443     | each pipeline VM's :8086       |

Inter-VM transport between the UI and the pipelines is **plain HTTP**
inside the private subnet by default. **HTTPS with self-signed certs is
also supported** - the UI proxy keeps `HITRACK_VERIFY_TLS=0` so it
accepts self-signed Influx certs.

```
   Storage arrays                          Operator browser
       â”‚ syslog/UDP 514                          â”‚  HTTPS 443 (self-signed OK)
       â–¼                                         â–¼
 +---------------------+      HTTP/HTTPS  +-------------------+
 | CDVL pipeline VM    |<---------------- | UI VM             |
 |  - listener_cdvl    |                  |  - FastAPI server |
 |  - local Influx     |    HTTP/HTTPS    |  - /influx        |
 +---------------------+<------+          |    -> CDVL Influx |
 +---------------------+       |          |  - /influx-bcp    |
 | BCP pipeline VM     |<------+----------|    -> BCP  Influx |
 |  - listener_bcp     |       |          |  - /influx-sify   |
 |  - local Influx     |       |          |    -> SIFY Influx |
 +---------------------+       |          +-------------------+
 +---------------------+       |
 | SIFY pipeline VM    |<------+
 |  - listener_sify    |
 |  - local Influx     |
 +---------------------+
```

The browser only ever talks to the UI VM. The UI VM fans out to each
pipeline VM via a reverse-proxy mount: `/influx` -> CDVL, `/influx-bcp`
-> BCP, `/influx-sify` -> SIFY.

**v1.4 additions on the UI VM**:

- A background pipeline-health monitor probes each pipeline VM's
  InfluxDB every `HITRACK_PIPELINE_POLL_SECS` (default 5s).
- New scrape-and-push job pulls the most recent alerts from each
  pipeline's bucket and broadcasts them over `wss://<ui-vm>/ws/alerts`
  to every connected browser. The dashboard's screen-blink + toast
  notifications fire off these WebSocket pushes (no polling).
- New endpoints: `/api/health/pipeline`, `/api/health/pipeline/{server}`,
  `/healthz`, `/ws/alerts`.
- When any of the three pipelines reports `status != ok` (or the UI
  cannot reach its FastAPI server at all), the dashboard renders a
  full-page 404 overlay with the failing pipeline's last error.

---

## 0. Required base RPMs (every VM)

These must already be present in your internal RPM mirror or pre-copied
from the connected build box:

```
python3.9            # RHEL 9.4 default
python3-pip
python3-virtualenv   # or 'python3-venv' alias - either is fine
rsync
firewalld
ca-certificates      # only needed on UI VM if you sign Influx certs
                     # with a private CA
```

Pipeline VMs additionally need the **InfluxDB v2 native RPM** (no
Docker, no Podman â€” both are blocked on this site). See
`deploy/INFLUXDB-SETUP.md` for the one-shot install + bootstrap.

The UI VM serves both the dashboard and the `/influx*` reverse-proxy
out of a single FastAPI process — **no nginx required** (and not
permitted by bank infra policy).

```bash
sudo dnf install -y python3 python3-pip python3-virtualenv rsync firewalld
```

---

## 1. Prepare the offline bundle (one-time, on a connected build box)

```bash
tar -xzf hi-track-alert_v1.4.1.tar.gz
cd hi-track-alert_v1.4.1
chmod +x scripts/*.sh

./scripts/prepare-offline-bundle.sh
```

That script downloads into `offline-bundles/`:

| File                                      | Used by                                      |
|-------------------------------------------|----------------------------------------------|
| `pip-wheels/listener/*.whl`               | `influxdb-client` for the pipeline VMs       |
| `pip-wheels/ui/*.whl`                     | `fastapi`, `uvicorn[standard]`, `httpx`, `websockets` (v1.4) |
| `influxdb-rpms/*.rpm`                     | native Influx install on each pipeline VM    |

Repackage and ship the whole release directory to **every** VM:

```bash
cd ..
tar -czf hi-track-alert_v1.4.1-with-offline.tar.gz hi-track-alert_v1.4.1/
```

---

## 2. Open firewalls

### On each pipeline VM (CDVL / BCP / SIFY)

```bash
sudo firewall-cmd --permanent --add-port=514/udp        # syslog from storage
sudo firewall-cmd --permanent --add-port=8086/tcp \
                  --add-source=<UI-VM-IP>/32            # only the UI may scrape Influx
sudo firewall-cmd --reload
```

### On the UI VM

```bash
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 3. Install InfluxDB on each pipeline VM (one-time)

InfluxDB is installed **natively as a systemd service** (no Docker /
Podman â€” neither is permitted on this site). Full instructions live
in `deploy/INFLUXDB-SETUP.md`; the short version:

```bash
sudo dnf install -y ./offline-bundles/influxdb-rpms/*.rpm
sudo systemctl enable --now influxdb

# Pick the right bucket per location:
#   CDVL -> SYSLOG_HIT_Bucket
#   BCP  -> SYSLOG_HIT_BCP_Bucket
#   SIFY -> SYSLOG_HIT_SIFY_Bucket
sudo influx setup \
    --org      HDFC \
    --bucket   SYSLOG_HIT_Bucket \
    --username admin \
    --password '<choose-one>' \
    --retention 0 \
    --force
```

`influx setup` prints the API token â€” capture it. You'll paste it
into `/etc/hi-track/listener.<loc>.env` on the same pipeline VM, and
into `/etc/hi-track/ui.env` on the UI VM (one slot per location, used
by the v1.4 server-side pipeline monitor + WebSocket scraper).

---

## 4. Install the listener stack on each pipeline VM

```bash
sudo tar -xzf hi-track-alert_v1.4.1-with-offline.tar.gz -C /root/releases/
cd /root/releases/hi-track-alert_v1.4.1
sudo chmod +x scripts/*.sh

sudo ./scripts/install.sh --role listener --location <CDVL|BCP|SIFY>
```

What the installer does for `--role listener`:

1. Creates user `hitrack`, group `hitrack`.
2. Creates `/opt/hi-track/listener/`, `/etc/hi-track/`, `/var/log/hi-track/`.
3. Copies **only** `listener/syslog_trap_listener_<loc>.py` (the
   self-contained file for this location — engine + IP maps in one file,
   no other locations referenced) into `/opt/hi-track/listener/`.
4. Builds a Python 3.9 venv and installs the offline wheels.
5. Drops the matching unit (`hi-track-listener-<loc>.service`) into
   `/etc/systemd/system/`.
6. Copies the matching `listener.<loc>.env.example` to
   `/etc/hi-track/listener.<loc>.env` (only if it doesn't exist yet -
   never overwrites your real env file).

---

## 5. Configure the per-location env file

```bash
sudo nano /etc/hi-track/listener.<loc>.env       # cdvl / bcp / sify
```

Minimum edits:

```env
HITRACK_INFLUX_TOKEN=<token-from-step-3>
HITRACK_INFLUX_VERIFY_TLS=0                       # 0 = accept self-signed local Influx
# Leave HITRACK_INFLUX_URL=http://127.0.0.1:8086 unless you front Influx with TLS
```

Then:

```bash
sudo systemctl enable --now hi-track-listener-<loc>
sudo systemctl status hi-track-listener-<loc>
sudo tail -F /var/log/hi-track/listener-<loc>.log
```

On a fresh box you should see one of these on every accepted packet:

```
[UDP] 10.227.60.189 (VSP_E990_4182â€¦) -> [modular_storage] sev=warning cat=disk_failure | â€¦
```

Foreign packets (a CDVL device hitting the BCP pipeline by mistake)
are silently dropped thanks to `HITRACK_ENV_ALLOWLIST=<loc>` baked
into the launcher.

---

## 6. Generate a self-signed TLS cert on the UI VM

```bash
sudo mkdir -p /etc/hi-track/tls
sudo chmod 0750 /etc/hi-track/tls
sudo chgrp hitrack /etc/hi-track/tls

sudo /root/releases/hi-track-alert_v1.4.1/deploy/generate-tls-cert.sh \
    --cn hi-track-ui.lan \
    --san 'DNS:hi-track-ui.lan,IP:10.x.x.x'
```

The helper writes:

```
/etc/hi-track/tls/hi-track.crt        owner root:hitrack  mode 0640
/etc/hi-track/tls/hi-track.key        owner root:hitrack  mode 0640
```

Browsers on operator workstations will see a self-signed warning the
first time. Either accept-and-continue, or import the certificate into
the workstation's local trust store (`certutil -addstore -f Root
hi-track.crt` on Windows; the equivalent KeyChain entry on macOS).

Self-signed certs for the **upstream** Influx on each pipeline VM are
fine to leave unsigned - the UI proxy has `HITRACK_VERIFY_TLS=0` by
default. See `deploy/SSL-SETUP.md` for the full TLS matrix.

---

## 7. Install the UI server on the UI VM

```bash
sudo tar -xzf hi-track-alert_v1.4.1-with-offline.tar.gz -C /root/releases/
cd /root/releases/hi-track-alert_v1.4.1
sudo ./scripts/install.sh --role ui
```

What the installer does for `--role ui`:

1. Creates `/opt/hi-track/ui/` and `/var/www/hi-track-alert/`.
2. Copies `server/server.py` + `server/requirements.txt`.
3. Builds a Python 3.9 venv and installs offline wheels
   (`fastapi`, `uvicorn[standard]`, `httpx`).
4. `rsync -a --delete frontend/dist/` -> `/var/www/hi-track-alert/`.
5. Drops `hi-track-ui.service` + `hi-track-ui.env.example` to
   `/etc/systemd/system/` and `/etc/hi-track/`.

Then edit `/etc/hi-track/ui.env` with the three pipeline VM URLs:

```env
HITRACK_UI_PORT=443
HITRACK_UI_TLS_CERT=/etc/hi-track/tls/hi-track.crt
HITRACK_UI_TLS_KEY=/etc/hi-track/tls/hi-track.key
HITRACK_UI_DIST=/var/www/hi-track-alert

# v1.4.1 default is HTTPS on all three pipeline VMs (PipelineMonitor
# scrapes every 5 s over HTTPS). Adjust to YOUR pipeline VM addresses;
# flip a single URL back to plain HTTP only if a specific pipeline VM
# is not yet serving TLS.
HITRACK_INFLUX_CDVL_URL=https://10.227.76.95:8086
HITRACK_INFLUX_BCP_URL=https://10.225.82.69:8086
HITRACK_INFLUX_SIFY_URL=https://10.226.111.68:8086

HITRACK_VERIFY_TLS=0      # accept self-signed Influx certs on pipeline VMs
HITRACK_CORS_ORIGINS=*
```

Boot:

```bash
sudo systemctl enable --now hi-track-ui
sudo systemctl status hi-track-ui
```

---

## 8. Smoke tests

### From the UI VM (proxy reachable?)

```bash
curl -k https://localhost/healthz
# -> {"ok":true,"dist_present":true,"proxies":{"/influx":"http://10.227...", ...}}

curl -k https://localhost/influx/health        # CDVL upstream
curl -k https://localhost/influx-bcp/health    # BCP  upstream
curl -k https://localhost/influx-sify/health   # SIFY upstream
```

`-k` because the UI cert is self-signed; `--cacert /etc/hi-track/tls/hi-track.crt`
if you want strict verification.

### From an operator workstation

Open `https://hi-track-ui.lan/` in the browser. Accept the self-signed
warning once. The Total Alerts and Alert Trend cards should populate
within ~5 seconds.

### End-to-end (synthetic syslog packet on CDVL)

```bash
# Run on the CDVL pipeline VM
echo "<142>1 $(date -u +%FT%TZ) test.local hitachi-trap - - - 100000, Acute, VSP_TEST_000001-CDVL, Hitachi_syslog, RefCode: A12345, smoke test" \
  | nc -u -w1 127.0.0.1 514
sudo tail -1 /var/log/hi-track/listener-cdvl.log

# Should land in the CDVL bucket within a second; verify from UI:
curl -k https://hi-track-ui.lan/healthz
# Then refresh the dashboard - the Total Alerts counter ticks up by 1.
```

---

## 9. Day-2 ops

| Task                                | Command                                                    |
|-------------------------------------|------------------------------------------------------------|
| Restart one listener                | `sudo systemctl restart hi-track-listener-<loc>`           |
| Restart the UI                      | `sudo systemctl restart hi-track-ui`                       |
| Tail listener logs                  | `sudo tail -F /var/log/hi-track/listener-<loc>.log`        |
| Tail UI logs                        | `sudo journalctl -u hi-track-ui -f`                        |
| Rotate TLS cert                     | rerun `generate-tls-cert.sh`, then `systemctl restart hi-track-ui` |
| Restart local InfluxDB              | `sudo systemctl restart influxdb`                          |
| Verify Influx is bound locally only | `sudo ss -lntp \| grep 8086`                               |

`/etc/logrotate.d/hi-track`:

```
/var/log/hi-track/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    su hitrack hitrack
}
```

---

## 10. Upgrade

```bash
# On each VM
sudo tar -xzf hi-track-alert_v1.X.Y-with-offline.tar.gz -C /root/releases/
sudo /root/releases/hi-track-alert_v1.X.Y/scripts/install.sh \
    --role <listener|ui> [--location <CDVL|BCP|SIFY>]
sudo systemctl restart hi-track-listener-<loc>   # pipeline VMs
sudo systemctl restart hi-track-ui               # UI VM
```

Preserved across upgrades:

- `/etc/hi-track/listener.<loc>.env`
- `/etc/hi-track/ui.env`
- `/etc/hi-track/tls/*`
- `/var/lib/influxdb/`

---

## 11. Troubleshooting

| Symptom                                                       | First thing to check                                                         |
|---------------------------------------------------------------|------------------------------------------------------------------------------|
| Dashboard 502 on `/influx-bcp/...`                            | BCP pipeline VM down, or `HITRACK_INFLUX_BCP_URL` mistyped in `ui.env`       |
| Dashboard says "Failed to load data" for one location only    | Same as above - check `healthz` JSON                                         |
| `systemctl status hi-track-listener-cdvl` -> Active: failed   | Missing/wrong token in `/etc/hi-track/listener.cdvl.env`                     |
| Operator browser shows cert warning                           | Expected - self-signed. Import `hi-track.crt` to workstation trust store    |
| Operator browser shows "secure connection failed"             | Wrong CN/SAN in cert. Re-run `generate-tls-cert.sh` with correct `--san`    |
| 8086 unreachable from UI VM                                   | firewalld on pipeline VM. `firewall-cmd --add-port=8086/tcp --add-source=<ui-ip>/32` |
| Listener log: `Connection refused` to `127.0.0.1:8086`        | local `influxd` not running on the pipeline VM                               |
| No packets land in CDVL bucket                                | `tcpdump -ni any udp port 514` on the CDVL VM; check storage device targets  |
| CDVL packet shows up in BCP bucket                            | Cannot happen in 1.4 - `HITRACK_ENV_ALLOWLIST` blocks it. File a bug.      |
