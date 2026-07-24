import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, Pin } from 'lucide-react';
import { getPublicAnnouncement, listPublicAnnouncements } from '@/lib/announcements';
import { absolutizeMediaUrl } from '@/lib/media-url';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const items = await listPublicAnnouncements();
  return items.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicAnnouncement(slug);
  if (!item) return { title: 'Announcement' };
  return {
    title: item.title,
    description: item.summary || item.title,
  };
}

export default async function AnnouncementDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublicAnnouncement(slug);
  if (!item) notFound();

  const image = absolutizeMediaUrl(item.featuredImageUrl) || item.featuredImageUrl;

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/announcements">Announcements</Link>
            <span>/</span>
            <span>{item.title}</span>
          </div>
          <div className="announcement-detail-meta">
            {item.isPinned ? (
              <span className="announcement-pill is-pin">
                <Pin aria-hidden /> Pinned
              </span>
            ) : null}
            {item.isNew ? <span className="announcement-pill is-new">NEW</span> : null}
            <time dateTime={item.publishAt}>
              {new Date(item.publishAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </time>
          </div>
          <h1>{item.title}</h1>
          {item.summary ? <p>{item.summary}</p> : null}
        </div>
      </header>

      <article className="section shell announcement-detail">
        {image ? (
          <div className="announcement-detail-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={item.featuredImageAlt} />
          </div>
        ) : null}
        {item.bodyHtml ? (
          <div
            className="prose announcement-detail-body"
            dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
          />
        ) : (
          <p>{item.summary}</p>
        )}
        {item.attachmentUrl ? (
          <p className="announcement-detail-pdf">
            <a
              className="button gold-button"
              href={item.attachmentUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Download aria-hidden /> Download {item.attachmentName || 'PDF'}
            </a>
          </p>
        ) : null}
        <p>
          <Link className="text-link" href="/announcements">
            <ArrowLeft aria-hidden /> Back to announcements
          </Link>
        </p>
      </article>
    </main>
  );
}
