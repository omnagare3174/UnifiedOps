/**
 * system-health microservice — public API.
 *
 * Owns the bottom-rail System Health Overview card cluster:
 *
 *   - Total Systems / Hitachi / Brocade / NetApp / Dell cards
 *   - Per-vendor "live / offline / status-unknown" rendering driven by
 *     the listener-health snapshot
 *   - Vendor-branded badge icons (Hitachi / Brocade / NetApp / Dell / Total)
 */
export { SystemHealthOverview }         from '../../components/cards/SystemHealthOverview';
export {
  HitachiBadge,
  BrocadeBadge,
  NetAppBadge,
  DellBadge,
  TotalBadge,
}                                        from '../../components/icons/VendorIcons';
