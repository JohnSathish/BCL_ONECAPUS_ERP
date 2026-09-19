import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export type SlsKpiTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';

export function SlsKpiCard({
  tone = 'sky',
  icon: Icon,
  label,
  value,
  hint,
  trend = '0%',
  trendLabel = 'No change',
  href,
  onClick,
  loading,
  className,
}: {
  tone?: SlsKpiTone;
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
  trendLabel?: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      <div className="sls-kpi-top">
        <span className="sls-kpi-icon">
          <Icon className="h-4 w-4" />
        </span>
        <div className="sls-kpi-trend">
          <b>{trend}</b>
          {trendLabel}
        </div>
      </div>
      <p className="sls-kpi-label">{label}</p>
      <p className="sls-kpi-value">{loading ? '—' : value}</p>
      {hint ? <p className="sls-kpi-hint">{hint}</p> : null}
    </>
  );
  const cls = cn('sls-kpi', `is-${tone}`, className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function SlsToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('sls-toolbar', className)}>{children}</div>;
}

export function SlsPill({
  tone = 'ok',
  children,
}: {
  tone?: 'ok' | 'amber' | 'muted' | 'warn';
  children: React.ReactNode;
}) {
  return <span className={cn('sls-pill', `is-${tone}`)}>{children}</span>;
}

export function SlsCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="sls-cta">
      {children}
    </Link>
  );
}
