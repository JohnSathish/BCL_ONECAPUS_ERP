'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { IQAC_NAV } from '@/lib/iqac-nav';

type Props = {
  currentHref?: string;
};

export function IqacSidebar({ currentHref }: Props) {
  const pathname = usePathname();
  const activeHref = currentHref ?? pathname;

  return (
    <nav className="admin-sidebar iqac-sidebar" aria-label="IQAC sections">
      <div className="admin-sidebar-head">
        <p>IQAC</p>
        <small>Internal Quality Assurance Cell</small>
      </div>
      <ul className="admin-sidebar-list">
        {IQAC_NAV.map((item) => {
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
