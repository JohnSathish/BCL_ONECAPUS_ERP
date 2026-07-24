'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ADMINISTRATION_BASE, ADMINISTRATION_NAV } from '@/lib/administration-nav';

type Props = {
  currentHref?: string;
};

export function AdministrationSidebar({ currentHref }: Props) {
  const pathname = usePathname();
  const activeHref = currentHref ?? pathname;

  return (
    <nav className="admin-sidebar" aria-label="Administration sections">
      <div className="admin-sidebar-head">
        <p>Administration</p>
        <small>Governance, quality &amp; institutional cells</small>
      </div>
      <ul className="admin-sidebar-list">
        <li>
          <Link
            href={ADMINISTRATION_BASE}
            className={activeHref === ADMINISTRATION_BASE ? 'is-active' : undefined}
            aria-current={activeHref === ADMINISTRATION_BASE ? 'page' : undefined}
          >
            <span>Overview</span>
            <ChevronRight aria-hidden />
          </Link>
        </li>
        {ADMINISTRATION_NAV.map((item) => {
          const active = activeHref === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={active ? 'is-active' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <span>{item.label}</span>
                <ChevronRight aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
