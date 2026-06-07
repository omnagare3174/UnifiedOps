#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# bootstrap-influx.sh - idempotent post-up helper for the 3-instance dev
# InfluxDB stack (CDVL / BCP / SIFY).
#
# `podman-compose up -d` already runs DOCKER_INFLUXDB_INIT_* on FIRST boot
# inside each container, creating the admin user + org + per-location
# bucket + per-location token. This script:
#   1. waits for /health on all three host ports,
#   2. echoes the active URLs + tokens + buckets so a dev can paste them
#      straight into the listener / server env vars.
#
# Re-runnable. Safe to call after every `up -d`.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a; . "$ENV_FILE"; set +a
fi

INFLUX_ORG="${INFLUX_ORG:-HDFC}"

INFLUX_CDVL_HOST_PORT="${INFLUX_CDVL_HOST_PORT:-8086}"
INFLUX_BCP_HOST_PORT="${INFLUX_BCP_HOST_PORT:-8087}"
INFLUX_SIFY_HOST_PORT="${INFLUX_SIFY_HOST_PORT:-8088}"

INFLUX_CDVL_BUCKET="${INFLUX_CDVL_BUCKET:-SYSLOG_HIT_Bucket}"
INFLUX_BCP_BUCKET="${INFLUX_BCP_BUCKET:-SYSLOG_HIT_BCP_Bucket}"
INFLUX_SIFY_BUCKET="${INFLUX_SIFY_BUCKET:-SYSLOG_HIT_SIFY_Bucket}"

INFLUX_CDVL_TOKEN="${INFLUX_CDVL_TOKEN:-unifiedops-dev-token-cdvl}"
INFLUX_BCP_TOKEN="${INFLUX_BCP_TOKEN:-unifiedops-dev-token-bcp}"
INFLUX_SIFY_TOKEN="${INFLUX_SIFY_TOKEN:-unifiedops-dev-token-sify}"

wait_health() {
    local label="$1" port="$2"
    local url="http://127.0.0.1:${port}/health"
    echo "==> waiting for ${label} ${url} ..."
    for i in {1..30}; do
        if curl -fsS "$url" >/dev/null 2>&1; then
            echo "    ${label} is up."
            return 0
        fi
        sleep 2
    done
    echo "ERROR: ${label} did not become healthy in 60s" >&2
    return 1
}

wait_health CDVL "$INFLUX_CDVL_HOST_PORT"
wait_health BCP  "$INFLUX_BCP_HOST_PORT"
wait_health SIFY "$INFLUX_SIFY_HOST_PORT"

cat <<EOF

==============================================================================
  UnifiedOps dev InfluxDB stack ready (3 instances).
  Org: ${INFLUX_ORG}

  +--------+-----------------------------+----------------------------+--------------------------------+
  | Site   | URL                         | Bucket                     | Token                          |
  +--------+-----------------------------+----------------------------+--------------------------------+
  | CDVL   | http://127.0.0.1:${INFLUX_CDVL_HOST_PORT}      | ${INFLUX_CDVL_BUCKET}         | ${INFLUX_CDVL_TOKEN}    |
  | BCP    | http://127.0.0.1:${INFLUX_BCP_HOST_PORT}      | ${INFLUX_BCP_BUCKET}     | ${INFLUX_BCP_TOKEN}     |
  | SIFY   | http://127.0.0.1:${INFLUX_SIFY_HOST_PORT}      | ${INFLUX_SIFY_BUCKET}    | ${INFLUX_SIFY_TOKEN}    |
  +--------+-----------------------------+----------------------------+--------------------------------+

  Listener env (drop into listener/listener.<loc>.env):

      # CDVL
      HITRACK_INFLUX_URL=http://127.0.0.1:${INFLUX_CDVL_HOST_PORT}
      HITRACK_INFLUX_TOKEN=${INFLUX_CDVL_TOKEN}
      HITRACK_INFLUX_ORG=${INFLUX_ORG}
      HITRACK_INFLUX_BUCKET=${INFLUX_CDVL_BUCKET}

      # BCP
      HITRACK_INFLUX_URL=http://127.0.0.1:${INFLUX_BCP_HOST_PORT}
      HITRACK_INFLUX_TOKEN=${INFLUX_BCP_TOKEN}
      HITRACK_INFLUX_ORG=${INFLUX_ORG}
      HITRACK_INFLUX_BUCKET=${INFLUX_BCP_BUCKET}

      # SIFY
      HITRACK_INFLUX_URL=http://127.0.0.1:${INFLUX_SIFY_HOST_PORT}
      HITRACK_INFLUX_TOKEN=${INFLUX_SIFY_TOKEN}
      HITRACK_INFLUX_ORG=${INFLUX_ORG}
      HITRACK_INFLUX_BUCKET=${INFLUX_SIFY_BUCKET}

  Server env (server/server.py picks these up):

      HITRACK_INFLUX_CDVL_URL=http://127.0.0.1:${INFLUX_CDVL_HOST_PORT}
      HITRACK_INFLUX_CDVL_TOKEN=${INFLUX_CDVL_TOKEN}
      HITRACK_INFLUX_CDVL_ORG=${INFLUX_ORG}
      HITRACK_INFLUX_CDVL_BUCKET=${INFLUX_CDVL_BUCKET}
      HITRACK_INFLUX_BCP_URL=http://127.0.0.1:${INFLUX_BCP_HOST_PORT}
      HITRACK_INFLUX_BCP_TOKEN=${INFLUX_BCP_TOKEN}
      HITRACK_INFLUX_BCP_ORG=${INFLUX_ORG}
      HITRACK_INFLUX_BCP_BUCKET=${INFLUX_BCP_BUCKET}
      HITRACK_INFLUX_SIFY_URL=http://127.0.0.1:${INFLUX_SIFY_HOST_PORT}
      HITRACK_INFLUX_SIFY_TOKEN=${INFLUX_SIFY_TOKEN}
      HITRACK_INFLUX_SIFY_ORG=${INFLUX_ORG}
      HITRACK_INFLUX_SIFY_BUCKET=${INFLUX_SIFY_BUCKET}
==============================================================================
EOF
