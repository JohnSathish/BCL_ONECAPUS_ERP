import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { IqacSidebar } from '@/components/iqac-sidebar';
import type { BreadcrumbItem } from '@/components/inner-page-shell';

type Props = {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  lead?: string | null;
  currentHref: string;
  children: React.ReactNode;
};

export function IqacShell({ title, breadcrumbs, lead, currentHref, children }: Props) {
  return (
    <main id="main" className="inner-page admin-page iqac-page">
      <header className="inner-page-hero">
        <div className="shell inner-page-hero-copy">
          <nav className="inner-breadcrumbs" aria-label="Breadcrumb">
            <ol>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <li key={`${item.label}-${index}`}>
                    {item.href && !isLast ? (
                      <Link href={item.href}>{item.label}</Link>
                    ) : (
                      <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
                    )}
                    {!isLast ? <ChevronRight aria-hidden /> : null}
                  </li>
                );
              })}
            </ol>
          </nav>
          <p className="inner-page-kicker">Don Bosco College Tura</p>
          <h1>{title}</h1>
          <span className="inner-page-title-rule" aria-hidden />
          {lead ? <p className="inner-page-lead">{lead}</p> : null}
        </div>
      </header>

      <div className="shell admin-layout">
        <IqacSidebar currentHref={currentHref} />
        <div className="inner-page-panel admin-panel">
          <article className="inner-page-prose">{children}</article>
        </div>
      </div>
    </main>
  );
}
