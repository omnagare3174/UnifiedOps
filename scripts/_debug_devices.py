from influxdb_client import InfluxDBClient

c = InfluxDBClient(
    url="http://127.0.0.1:8086",
    token="unifiedops-dev-token-cdvl",
    org="HDFC",
)
q = c.query_api()

print("=== distinct query result ===")
flux = """
from(bucket: "Hitachi_CDVL_Bucket")
  |> range(start: -15m)
  |> filter(fn: (r) => r._measurement != "syslog_listener_heartbeat")
  |> filter(fn: (r) => r._field == "raw_message")
  |> filter(fn: (r) => exists r.array_name and r.array_name != "unknown")
  |> keep(columns: ["array_name"])
  |> distinct(column: "array_name")
  |> keep(columns: ["_value"])
"""
for t in q.query(flux):
    for rec in t.records:
        print("rec:", rec.values)

print()
print("=== raw rows (no distinct) ===")
flux2 = """
from(bucket: "Hitachi_CDVL_Bucket")
  |> range(start: -15m)
  |> filter(fn: (r) => r._measurement != "syslog_listener_heartbeat")
  |> filter(fn: (r) => r._field == "raw_message")
  |> filter(fn: (r) => exists r.array_name and r.array_name != "unknown")
"""
n = 0
for t in q.query(flux2):
    for rec in t.records:
        n += 1
        if n <= 5:
            print(f"rec keys={list(rec.values.keys())} array_name={rec.values.get('array_name')}")
print(f"total raw rows: {n}")
