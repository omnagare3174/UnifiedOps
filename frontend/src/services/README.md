# `src/services/` — frontend microservices

Each directory under `services/` is a **vertical slice** that owns one
concern end-to-end (data fetching, components, hooks, types). Today these
slices ship in a single bundle, but the `index.ts` barrel at the root of
each service is the *only* surface other services should import from.

| Service              | Responsibility                                                                                          | Public hook(s) / component(s)                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `alerts/`            | Real alert feed from InfluxDB; donuts, trend, top systems, severity, type breakdown, details modal      | `useRecentAlerts`, `TotalAlertsCard`, `AlertSeverityCard`, `AlertTrendCard`, `TopSystemsCard`, `AlertDetailsModal` |
| `listener-health/`   | Heartbeat-driven listener up/down/infra-down; modal raise + acknowledgement                             | `useListenerHealth`, `ListenerDownModal`, `InfrastructureDownModal`                                                  |
| `system-health/`     | Bottom-rail vendor health cards + vendor badge icons                                                    | `SystemHealthOverview`                                                                                               |
| `dashboard/`         | Chrome — header (location / range / refresh / live status), NTP card                                    | `Header`, `NTPCard`                                                                                                  |
| `ui-kit/`            | Shared, domain-free primitives — Card, FilterSelect, Toast, ScreenBlink, AreaChart, DonutChart          | many                                                                                                                 |
| `icons/`             | Single import path for vendor SVG badges and the curated `lucide-react` icons                           | many                                                                                                                 |

## Dependency rules

```
ui-kit  <--  alerts
ui-kit  <--  listener-health
ui-kit  <--  system-health
ui-kit  <--  dashboard

icons   <--  all

dashboard / system-health / alerts may depend on listener-health (read-only)
listener-health depends on nothing other than ui-kit + icons
```

`App.tsx` is the *composition root*: it imports from every service and
wires them together. No service is allowed to import from `App.tsx` or
from a sibling service's internals — only from its `index.ts` barrel.

## Adding a new service

1. `mkdir services/<name>/`
2. Put components / hooks / types either inside the service directory
   or under the legacy `src/components/`, `src/hooks/`. (Inline is
   preferred for new services; legacy paths are kept while migration is
   in progress.)
3. Write `services/<name>/index.ts` re-exporting the public API.
4. Wire it from `App.tsx`.

## Future: physical split

Today components physically live in `src/components/**`. As the migration
progresses, files will be moved into their owning service directory so
each `services/<name>/` becomes a self-contained vertical slice.
