'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import type { FlashAnnouncement } from '@/lib/flash-announcements';

type Props = {
  items: FlashAnnouncement[];
  label?: string;
};

function FlashItem({
  item,
  inert = false,
}: {
  item: FlashAnnouncement;
  /** Duplicate marquee copy — keep out of tab order. */
  inert?: boolean;
}) {
  const body = (
    <>
      <Megaphone aria-hidden className="flash-news-item-icon" />
      {item.isNew ? <span className="flash-news-new">NEW</span> : null}
      <span className="flash-news-item-title">{item.title}</span>
    </>
  );

  if (!item.href || inert) {
    return (
      <span className="flash-news-item" aria-hidden={inert || undefined}>
        {body}
      </span>
    );
  }

  const external = /^https?:\/\//i.test(item.href);
  if (external) {
    return (
      <a className="flash-news-item" href={item.href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }

  return (
    <Link className="flash-news-item" href={item.href}>
      {body}
    </Link>
  );
}

function StaticTicker({ items, label }: { items: FlashAnnouncement[]; label: string }) {
  return (
    <aside className="flash-news-bar" aria-label={label}>
      <div className="flash-news-label">
        <Megaphone aria-hidden />
        <span className="flash-news-label-full">Announcements</span>
        <span className="flash-news-label-short">Flash</span>
      </div>
      <div className="flash-news-viewport is-static">
        <div className="flash-news-track">
          {items.map((item) => (
            <div key={item.id} className="flash-news-slot" data-flash-item="true">
              <FlashItem item={item} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function FlashNewsTicker({ items, label = 'Announcements' }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [loopWidth, setLoopWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const resumeTimer = useRef<number | null>(null);

  const clearResume = () => {
    if (resumeTimer.current != null) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  };

  const pause = useCallback(() => {
    clearResume();
    setPaused(true);
  }, []);

  const scheduleResume = useCallback(() => {
    clearResume();
    resumeTimer.current = window.setTimeout(() => {
      setPaused(false);
      resumeTimer.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport || !items.length) return;

    const measure = () => {
      const nodes = track.querySelectorAll<HTMLElement>('[data-flash-set="0"]');
      if (nodes.length < items.length) {
        setLoopWidth(0);
        return;
      }
      let width = 0;
      for (let i = 0; i < items.length; i += 1) {
        width += nodes[i].getBoundingClientRect().width;
      }
      // gaps between items (28px) + trailing gap before the duplicated set
      width += items.length * 28;
      setLoopWidth(width);
    };

    let raf1 = 0;
    let raf2 = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(measure);
      });
    };

    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(track);
    observer.observe(viewport);
    void document.fonts?.ready?.then(scheduleMeasure);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer.disconnect();
    };
  }, [items]);

  useEffect(() => () => clearResume(), []);

  if (!items.length) return null;

  if (reducedMotion || items.length === 1) {
    return <StaticTicker items={items} label={label} />;
  }

  // Always marquee when 2+ items so linked announcements keep scrolling.
  // Pause only on hover/touch — focus-pause was freezing the bar after a URL
  // was added (links become focusable and never resumed cleanly).
  const durationSec = loopWidth > 0 ? Math.max(18, loopWidth / 42) : 28;

  return (
    <aside
      className={`flash-news-bar${paused ? ' is-paused' : ''}`}
      aria-label={label}
      onMouseEnter={pause}
      onMouseLeave={scheduleResume}
      onTouchStart={pause}
      onTouchEnd={scheduleResume}
    >
      <div className="flash-news-label">
        <Megaphone aria-hidden />
        <span className="flash-news-label-full">Announcements</span>
        <span className="flash-news-label-short">Flash</span>
      </div>
      <div className="flash-news-viewport" ref={viewportRef}>
        <div
          className="flash-news-track is-marquee"
          ref={trackRef}
          style={
            loopWidth > 0
              ? {
                  ['--flash-loop' as string]: `${loopWidth}px`,
                  animationDuration: `${durationSec}s`,
                }
              : {
                  ['--flash-loop' as string]: '50%',
                  animationDuration: `${durationSec}s`,
                }
          }
        >
          {Array.from({ length: 2 }, (_, copyIndex) =>
            items.map((item) => (
              <div
                key={`${item.id}-c${copyIndex}`}
                className="flash-news-slot"
                data-flash-item="true"
                data-flash-set={copyIndex}
                aria-hidden={copyIndex > 0}
              >
                <FlashItem item={item} inert={copyIndex > 0} />
              </div>
            )),
          )}
        </div>
      </div>
    </aside>
  );
}
