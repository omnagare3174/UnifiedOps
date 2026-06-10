import os
from influxdb_client import InfluxDBClient

client = InfluxDBClient(url="http://127.0.0.1:8486", token="unifiedops-dev-token-heartbeat-cdvl", org="HDFC")
query_api = client.query_api()
tables = query_api.query('from(bucket:"CDVL_Heartbeat_Bucket") |> range(start:-10m) |> filter(fn: (r) => r._measurement == "syslog_listener_heartbeat")')
for table in tables:
    for record in table.records:
        print(f"{record.values.get('site')} {record.values.get('oem')} {record.values.get('listener')} {record.get_time()}")
