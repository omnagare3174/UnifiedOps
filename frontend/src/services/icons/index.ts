/**
 * icons microservice — central icon barrel.
 *
 * - Re-exports the bespoke vendor badges (Hitachi / Brocade / NetApp / Dell
 *   / Total) which are SVG-coded to brand colors and live in
 *   `services/system-health` semantically; here we re-export them so any
 *   other service that needs a vendor icon (header, modal, trap-feed)
 *   does NOT have to depend on `system-health`.
 * - Re-exports the generic UI icons (`ExternalIcon`, etc.) used across
 *   cards.
 * - Re-exports a small curated set from `lucide-react` so consumers stay
 *   on one import path and the bundle remains tree-shakeable.
 *
 * Import only what you need:
 *
 *     import { ExternalIcon, AlertCircle, ChevronDown } from '../icons';
 */
export {
  HitachiBadge, BrocadeBadge, NetAppBadge, DellBadge, TotalBadge,
} from '../../components/icons/VendorIcons';
export { ExternalIcon } from '../../components/icons/Icons';

// Curated lucide-react re-exports. Add more here as services need them;
// keeping a single import path means the bundle splitter has one
// well-known module to chunk into the `icons` group (see vite.config.ts).
export {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  ExternalLink,
  Filter,
  HeartPulse,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
