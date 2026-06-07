import type { HealthVendor } from '../../types';
import {
  BrocadeBadge,
  DellBadge,
  HitachiBadge,
  NetAppBadge,
  TotalBadge,
} from '../icons/VendorIcons';

interface Props {
  vendors: HealthVendor[];
}

export function SystemHealthOverview({ vendors }: Props) {
  return (
    <section className="health-section">
      <h3 className="card-title" style={{ paddingLeft: 4, marginBottom: 4 }}>
        System Health Overview
      </h3>
      <div className="health-grid">
        {vendors.map(v => (
          <VendorCard key={v.key} v={v} />
        ))}
      </div>
    </section>
  );
}

function VendorCard({ v }: { v: HealthVendor }) {
  return (
    <div className="health-card">
      <div className="health-card__icon" style={{ background: 'transparent' }}>
        <VendorIcon kind={v.icon} />
      </div>
      <div>
        <div className="health-card__name">{v.name}</div>
        <div className="health-card__count">{v.count}</div>
        <div className="health-card__breakdown">
          <span className="health-pill health-pill--critical">
            <span className="health-pill__dot" />
            {v.critical} Critical
          </span>
          <span className="health-pill health-pill--warning">
            <span className="health-pill__dot" />
            {v.warning} Warning
          </span>
        </div>
      </div>
    </div>
  );
}

function VendorIcon({ kind }: { kind: HealthVendor['icon'] }) {
  switch (kind) {
    case 'hitachi': return <HitachiBadge size={36} />;
    case 'netapp':  return <NetAppBadge size={36} />;
    case 'dell':    return <DellBadge size={36} />;
    case 'brocade': return <BrocadeBadge size={36} />;
    case 'total':   return <TotalBadge size={36} />;
  }
}
