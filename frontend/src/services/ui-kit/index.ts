/**
 * ui-kit microservice — shared primitives.
 *
 * Visual + interaction building blocks that are domain-agnostic. Every
 * other service composes these; nothing in here is allowed to import
 * back into alerts / listener-health / system-health / dashboard.
 *
 *   - Card / CardTitle           (consistent panel wrapper)
 *   - FilterSelect               (themed dropdown with optional search)
 *   - ToastStack                 (bottom-right notification stack)
 *   - ScreenBlink                (severity-coloured full-screen blink)
 *   - AreaChart / DonutChart     (lightweight SVG charts; no recharts dep)
 *   - useCursorTooltip           (generic cursor-tracking tooltip hook)
 */
export { Card, CardTitle }              from '../../components/cards/Card';
export { FilterSelect }                 from '../../components/overlays/FilterSelect';
export type { FilterOption }            from '../../components/overlays/FilterSelect';
export { ToastStack }                   from '../../components/overlays/Toast';
export type { ToastItem }               from '../../components/overlays/Toast';
export { ScreenBlink }                  from '../../components/overlays/ScreenBlink';
export { AreaChart }                    from '../../components/charts/AreaChart';
export { DonutChart }                   from '../../components/charts/DonutChart';
export { useCursorTooltip }             from '../../hooks/useCursorTooltip';
