/**
 * Thin client for the FastAPI trap-sender backend at /api/*.
 *
 * Backend lives in `dev/trap_sender_ui.py`; everything here is plain
 * `fetch()` calls — no websockets needed because traps are inherently
 * request/response (the backend opens a UDP socket per request and
 * answers with a per-packet result).
 */

export interface Vendor {
  vendor: string;
  locations: string[];
}

export interface CatalogueEntry {
  severity: string;
  refcode:  string;
  text:     string;
}

export interface LocationInfo {
  ips: Array<{ ip: string; array: string }>;
  default_target: string;
}

export interface SendRequest {
  vendor:      string;
  location:    string;
  source_ip?:  string;
  refcode?:    string;
  severity?:   string;
  text?:       string;
  count:       number;
  interval:    number;   // seconds between packets in a burst
  target?:     string;
  use_gum?:    boolean;
  rfc5424?:    boolean;
  random_pick?: boolean;
}

export interface SendRecord {
  ts:         string;
  vendor:     string;
  location:   string;
  target:     string;
  source_ip:  string;
  array_name: string;
  severity:   string;
  refcode:    string;
  text:       string;
  envelope:   string;
  format:     string;
  packet:     string;
}

export interface SendResponse {
  ok:      boolean;
  sent:    number;
  errors:  string[];
  records: SendRecord[];
}

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`GET ${path} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function jpost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`POST ${path} → HTTP ${r.status}: ${text}`);
  }
  return (await r.json()) as T;
}

export const api = {
  vendors:    () => jget<Vendor[]>('/api/vendors'),
  catalog:    (vendor: string) => jget<CatalogueEntry[]>(`/api/catalog?vendor=${encodeURIComponent(vendor)}`),
  locations:  (vendor: string) => jget<Record<string, LocationInfo>>(`/api/locations?vendor=${encodeURIComponent(vendor)}`),
  severities: () => jget<string[]>('/api/severities'),
  history:    (limit = 50) => jget<SendRecord[]>(`/api/history?limit=${limit}`),
  send:       (req: SendRequest) => jpost<SendResponse>('/api/send', req),
  health:     () => jget<{ ok: boolean }>('/healthz'),
};
