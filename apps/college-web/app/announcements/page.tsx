import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Download, Megaphone, Pin } from 'lucide-react';
import { listPublicAnnouncements } from '@/lib/announcements';
import { absolutizeMediaUrl } from '@/lib/media-url';

export const metadata: Metadata = {
  title: 'Announcements',
  description: 'Latest campus announcements from Don Bosco College, Tura.',
};

export default async function AnnouncementsIndexPage() {
  const items = await listPublicAnnouncements();

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Announcements</span>
          </div>
          <span className="eyebrow gold">Stay informed</span>
          <h1>Announcements</h1>
          <p>Pinned and dated campus announcements with images and downloadable circulars.</p>
        </div>
      </header>

      <section className="section shell">
        {!items.length ? (
          <p className="text-muted">No published announcements yet.</p>
        ) : (
          <div className="announcement-grid">
            {items.map((item) => {
              const image = absolutizeMediaUrl(item.featuredImageUrl) || item.featuredImageUrl;
              const external = /^https?:\/\//i.test(item.href);
              const TitleLink = external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              ) : (
                <Link href={item.href}>{item.title}</Link>
              );
              const Media = image ? (
                external ? (
                  <a
                    href={item.href}
                    className="announcement-card-media"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={item.featuredImageAlt} />
                  </a>
                ) : (
                  <Link href={item.href} className="announcement-card-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={item.featuredImageAlt} />
                  </Link>
                )
              ) : (
                <div className="announcement-card-media is-placeholder" aria-hidden>
                  <Megaphone />
                </div>
              );
              return (
                <article className="announcement-card" key={item.id}>
                  {Media}
                  <div className="announcement-card-body">
                    <div className="announcement-card-meta">
                      {item.isPinned ? (
                        <span className="announcement-pill is-pin">
                          <Pin aria-hidden /> Pinned
                        </span>
                      ) : null}
                      {item.isNew ? <span className="announcement-pill is-new">NEW</span> : null}
                      <time dateTime={item.publishAt}>
                        {new Date(item.publishAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </time>
                    </div>
                    <h2>{TitleLink}</h2>
                    {item.summary ? <p>{item.summary}</p> : null}
                    <div className="announcement-card-actions">
                      {external ? (
                        <a
                          className="text-link"
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open link <ArrowRight aria-hidden />
                        </a>
                      ) : (
                        <Link className="text-link" href={item.href}>
                          Read more <ArrowRight aria-hidden />
                        </Link>
                      )}
                      {item.attachmentUrl ? (
                        <a
                          className="text-link"
                          href={item.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download aria-hidden /> {item.attachmentName || 'PDF'}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
