/**
 * dashboard microservice — public API.
 *
 * Composition root + chrome:
 *
 *   - Header (location picker, range picker, refresh, live status)
 *   - NTPCard (per-protocol status; small enough to live with the chrome)
 *
 * The actual dashboard composition lives in src/App.tsx (one level up)
 * to keep `services/*` peer-to-peer.
 */
export { Header }                       from '../../components/header/Header';
export { NTPCard }                      from '../../components/cards/NTPCard';
