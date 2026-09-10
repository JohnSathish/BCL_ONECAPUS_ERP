'use client';

import { useEffect, useState } from 'react';

export type GalleryLightboxItem = {
  id: string;
  title: string | null;
  caption: string | null;
  altText: string | null;
  credit: string | null;
  urls: { original: string; card: string; thumb: string };
};

export function SchoolGalleryLightbox({
  items,
  start,
  allowDownload,
  shareUrl,
  onClose,
}: {
  items: GalleryLightboxItem[];
  start: number;
  allowDownload: boolean;
  shareUrl: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState(1);
  const [slideshow, setSlideshow] = useState(false);
  const item = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % items.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose]);

  useEffect(() => {
    if (!slideshow) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 3500);
    return () => window.clearInterval(t);
  }, [slideshow, items.length]);

  if (!item) return null;
  const encoded = encodeURIComponent(shareUrl);

  return (
    <div
      className="sls-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.caption || item.title || 'Photograph'}
      onClick={onClose}
    >
      <div
        className="sls-lightbox-inner"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          (e.currentTarget as HTMLElement).dataset.x = String(e.touches[0]?.clientX ?? 0);
        }}
        onTouchEnd={(e) => {
          const startX = Number((e.currentTarget as HTMLElement).dataset.x || 0);
          const endX = e.changedTouches[0]?.clientX ?? startX;
          if (endX - startX > 40) setIndex((i) => (i - 1 + items.length) % items.length);
          if (startX - endX > 40) setIndex((i) => (i + 1) % items.length);
        }}
      >
        <img
          src={item.urls.original}
          alt={item.altText || item.caption || ''}
          style={{ transform: `scale(${zoom})` }}
        />
        <p className="sls-lightbox-caption">
          {item.caption || item.title || ''}
          {item.credit ? ` · ${item.credit}` : ''}
        </p>
        <div className="sls-lightbox-bar">
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            aria-label="Previous photograph"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            aria-label="Next photograph"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => (z === 1 ? 1.6 : 1))}
            aria-label="Zoom photograph"
          >
            Zoom
          </button>
          <button
            type="button"
            onClick={() => {
              const el = document.querySelector('.sls-lightbox-inner img');
              if (el && el.requestFullscreen) void el.requestFullscreen();
            }}
          >
            Full screen
          </button>
          <button type="button" onClick={() => setSlideshow((v) => !v)}>
            {slideshow ? 'Stop slideshow' : 'Slideshow'}
          </button>
          <button type="button" onClick={() => void navigator.clipboard.writeText(shareUrl)}>
            Copy link
          </button>
          <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          <a href={`mailto:?subject=School gallery&body=${encoded}`}>Email</a>
          {allowDownload ? (
            <a href={item.urls.original} download>
              Download
            </a>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close gallery">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
