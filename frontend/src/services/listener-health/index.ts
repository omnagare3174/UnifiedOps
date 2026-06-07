/**
 * listener-health microservice — public API.
 *
 * Owns the heartbeat-driven listener-availability domain:
 *
 *   - useListenerHealth() — polls /api/health/listeners (will migrate to
 *     WS push from health_check.py)
 *   - ListenerDownModal    — one-shot modal raised when a listener stops
 *     heartbeating (heartbeat store reachable, listener stale)
 *   - InfrastructureDownModal — distinct red-themed modal raised when the
 *     per-site heartbeat InfluxDB itself is unreachable; suppresses any
 *     listener-down modal for that site to avoid misleading the operator
 */
export { useListenerHealth }           from '../../hooks/useListenerHealth';
export { useListenerHealthWs }         from '../../hooks/useListenerHealthWs';
export type {
  ListenerRow,
  ListenerState,
  ListenerDownEvent,
  SiteHealth,
  InfraEvent,
  ListenerHealthSnapshot,
}                                       from '../../hooks/useListenerHealth';
export { ListenerDownModal }           from '../../components/overlays/ListenerDownModal';
export { InfrastructureDownModal }     from '../../components/overlays/InfrastructureDownModal';
export { ConnectionLostModal }         from '../../components/overlays/ConnectionLostModal';
export { useWebSocket }                from '../../hooks/useWebSocket';
export type { WsStatus }               from '../../hooks/useWebSocket';
export { useListenerHealthStore }      from '../../stores/useListenerHealthStore';
export { useWsConnector } from '../../lib/wsConnector';
export type { DashboardSubscription } from '../../lib/wsConnector';
