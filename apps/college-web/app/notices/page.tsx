import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Download } from 'lucide-react';
import { listPublicNoticesDetailed } from '@/lib/notices';
import { formatNoticeDate, noticeBadgeStyles } from '@/lib/information-hub';

export const metadata: Metadata = {
  title: 'Notice Board',
  description: 'Official circulars and notices from Don Bosco College, Tura.',
};

export default async function NoticesIndexPage() {
  const items = await listPublicNoticesDetailed();

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Notice Board</span>
          </div>
          <span className="eyebrow gold">Official updates</span>
          <h1>Notice Board</h1>
          <p>Published circulars, exam notices, and campus announcements with downloadable PDFs.</p>
        </div>
      </header>

      <section className="section shell">
        {!items.length ? (
          <p className="text-muted">No published notices yet.</p>
        ) : (
          <div className="notice-index-list">
            {items.map((item) => {
              const badge = item.urgent
                ? 'URGENT'
                : item.attachments.length
                  ? 'PDF'
                  : item.priority === 'IMPORTANT'
                    ? 'IMPORTANT'
                    : 'NEW';
              const style = noticeBadgeStyles[badge] ?? noticeBadgeStyles.NEW;
              const primaryHref = item.attachmentUrl || item.href;
              const external = /^https?:\/\//i.test(primaryHref);
              return (
                <article
                  className={`notice-index-card${item.urgent ? ' is-urgent' : ''}`}
                  key={item.id}
                >
                  <div className="notice-index-meta">
                    <span
                      className="info-badge"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {badge}
                    </span>
                    <time dateTime={item.publishAt} suppressHydrationWarning>
                      {formatNoticeDate(item.publishAt)}
                    </time>
                  </div>
                  <h2>
                    {external ? (
                      <a href={primaryHref} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      <Link href={item.href}>{item.title}</Link>
                    )}
                  </h2>
                  {item.attachments.length ? (
                    <ul className="notice-index-files">
                      {item.attachments.map((file) => (
                        <li key={file.url}>
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <Download aria-hidden /> {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Link className="text-link" href={item.href}>
                      View notice <ArrowRight aria-hidden />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
