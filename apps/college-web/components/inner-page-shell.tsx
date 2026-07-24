import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Landmark, type LucideIcon } from 'lucide-react';
import { navigation } from '@/lib/navigation';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type InnerQuickLink = {
  label: string;
  href: string;
  Icon?: LucideIcon;
};

type Props = {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  eyebrow?: string;
  lead?: string | null;
  quickLinks?: InnerQuickLink[];
  showQuoteCard?: boolean;
  children: React.ReactNode;
  afterArticle?: React.ReactNode;
};

const defaultAboutLinks: InnerQuickLink[] = [
  { label: 'About overview', href: '/about' },
  ...navigation[0].items.map(([label, href]) => ({ label, href })),
].slice(0, 8);

const defaultQuickLinks: InnerQuickLink[] = [
  { label: 'Apply for admission', href: '/admission/apply' },
  { label: 'Explore programmes', href: '/academics/programmes' },
  { label: 'News & notices', href: '/news' },
  { label: 'Downloads', href: '/downloads' },
  { label: 'Contact the college', href: '/contact' },
];

export function InnerPageShell({
  title,
  breadcrumbs,
  eyebrow = 'Don Bosco College Tura',
  lead,
  quickLinks,
  showQuoteCard = true,
  children,
  afterArticle,
}: Props) {
  const links = quickLinks?.length
    ? quickLinks
    : breadcrumbs.some((item) => item.href?.startsWith('/about') || item.label === 'About Us')
      ? defaultAboutLinks
      : defaultQuickLinks;

  return (
    <main id="main" className="inner-page">
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
          <p className="inner-page-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <span className="inner-page-title-rule" aria-hidden />
          {lead ? <p className="inner-page-lead">{lead}</p> : null}
        </div>
      </header>

      <div className="shell inner-page-body">
        <div className="inner-page-panel">
          <article className="inner-page-prose">{children}</article>
          {afterArticle}
        </div>

        <aside className="inner-page-aside">
          <div className="inner-quick-links">
            <h2>Quick Links</h2>
            <ul>
              {links.map((link) => {
                const Icon = link.Icon ?? Landmark;
                return (
                  <li key={link.href}>
                    <Link href={link.href}>
                      <span className="inner-quick-links-icon" aria-hidden>
                        <Icon />
                      </span>
                      <span>{link.label}</span>
                      <ChevronRight aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {showQuoteCard ? (
            <figure className="inner-quote-card">
              <div className="inner-quote-card-portrait" aria-hidden>
                <Image src="/images/st-john-bosco.png" alt="" fill sizes="220px" />
              </div>
              <blockquote>
                <p>“To form good Christians and honest citizens.”</p>
                <figcaption>— Don Bosco</figcaption>
              </blockquote>
            </figure>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

export const HISTORY_TIMELINE = [
  { year: '1987', label: 'College Established' },
  { year: '1988', label: 'Arts Stream Begins' },
  { year: '1992', label: 'Science Introduced' },
  { year: '2002', label: 'Commerce Begins' },
  { year: '2004', label: 'Campus Growth' },
] as const;

export function HistoryTimeline() {
  return (
    <section className="inner-timeline" aria-label="College milestones">
      <h2>
        <Landmark aria-hidden />
        Milestones
      </h2>
      <ol>
        {HISTORY_TIMELINE.map((item) => (
          <li key={item.year}>
            <span className="inner-timeline-dot" aria-hidden />
            <strong>{item.year}</strong>
            <span>{item.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
