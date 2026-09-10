'use client';

import { useState } from 'react';
import { SchoolGalleryLightbox, type GalleryLightboxItem } from './school-gallery-lightbox';

export function SchoolGalleryAlbumView({
  title,
  items,
  allowDownload,
  shareUrl,
}: {
  title: string;
  items: GalleryLightboxItem[];
  allowDownload: boolean;
  shareUrl: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="sls-masonry">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="sls-masonry-item"
            onClick={() => setOpen(index)}
            aria-label={`Open photograph ${index + 1} in ${title}`}
          >
            <img src={item.urls.card} alt={item.altText || item.caption || title} loading="lazy" />
            {item.caption ? <span>{item.caption}</span> : null}
          </button>
        ))}
      </div>
      {open != null ? (
        <SchoolGalleryLightbox
          items={items}
          start={open}
          allowDownload={allowDownload}
          shareUrl={shareUrl}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}
