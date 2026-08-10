import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Bell, Download } from 'lucide-react';
import { getPublicNotice, listPublicNoticesDetailed } from '@/lib/notices';
import { formatNoticeDate, noticeBadgeStyles } from '@/lib/information-hub';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const items = await listPublicNoticesDetailed();
  return items.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicNotice(slug);
  if (!item) return { title: 'Notice' };
  return {
    title: item.title,
    description: item.title,
  };
}

export default async function NoticeDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublicNotice(slug);
  if (!item) notFound();

  const badge = item.urgent ? 'URGENT' : item.attachments.length ? 'PDF' : 'NEW';
  const style = noticeBadgeStyles[badge] ?? noticeBadgeStyles.NEW;

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/notices">Notice Board</Link>
            <span>/</span>
            <span>{item.title}</span>
          </div>
          <div className="announcement-detail-meta">
            <span className="info-badge" style={{ background: style.bg, color: style.color }}>
              <Bell aria-hidden /> {badge}
            </span>
            <time dateTime={item.publishAt} suppressHydrationWarning>
              {formatNoticeDate(item.publishAt)}
            </time>
          </div>
          <h1>{item.title}</h1>
        </div>
      </header>

      <article className="section shell announcement-detail">
        {item.bodyHtml ? (
          <div
            className="prose announcement-detail-body"
            dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
          />
        ) : (
          <p>See the attachments below for the full circular.</p>
        )}

        {item.attachments.length ? (
          <ul className="notice-detail-files">
            {item.attachments.map((file) => (
              <li key={file.url}>
                <a
                  className="button gold-button"
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download aria-hidden /> Download {file.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <p>
          <Link className="text-link" href="/notices">
            <ArrowLeft aria-hidden /> Back to Notice Board
          </Link>
        </p>
      </article>
    </main>
  );
}
