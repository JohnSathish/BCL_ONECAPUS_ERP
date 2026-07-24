'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import type { FlashAnnouncement } from '@/lib/flash-announcements';

type Props = {
  items: FlashAnnouncement[];
  label?: string;
};

function FlashItem({ item }: { item: FlashAnnouncement }) {
  const body = (
    <>
      <Megaphone aria-hidden className="flash-news-item-icon" />
      {item.isNew ? <span className="flash-news-new">NEW</span> : null}
      <span className="flash-news-item-title">{item.title}</span>
    </>
  );

  if (!item.href) {
    return <span className="flash-news-item">{body}</span>;
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
  const [needsMarquee, setNeedsMarquee] = useState(false);
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
        setNeedsMarquee(false);
        return;
      }
      let width = 0;
      for (let i = 0; i < items.length; i += 1) {
        width += nodes[i].getBoundingClientRect().width;
      }
      // include gaps between items (28px) + trailing gap before the loop restarts
      width += Math.max(0, items.length) * 28;
      const viewportWidth = viewport.getBoundingClientRect().width;
      setLoopWidth(width);
      // Only marquee-duplicate when the unique set overflows the bar.
      // Otherwise 2 short items would appear as A, B, A, B in one view.
      setNeedsMarquee(width > viewportWidth + 8);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => () => clearResume(), []);

  if (!items.length) return null;

  if (reducedMotion || items.length === 1) {
    return <StaticTicker items={items} label={label} />;
  }

  const durationSec = loopWidth > 0 ? Math.max(18, loopWidth / 42) : 28;
  // Second copy is only for seamless CSS loop — aria-hidden so screen readers
  // hear each announcement once.
  const copies = needsMarquee ? 2 : 1;

  return (
    <aside
      className={`flash-news-bar${paused && needsMarquee ? ' is-paused' : ''}`}
      aria-label={label}
      onMouseEnter={needsMarquee ? pause : undefined}
      onMouseLeave={needsMarquee ? scheduleResume : undefined}
      onFocusCapture={needsMarquee ? pause : undefined}
      onBlurCapture={
        needsMarquee
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                scheduleResume();
              }
            }
          : undefined
      }
      onTouchStart={needsMarquee ? pause : undefined}
      onTouchEnd={needsMarquee ? scheduleResume : undefined}
    >
      <div className="flash-news-label">
        <Megaphone aria-hidden />
        <span className="flash-news-label-full">Announcements</span>
        <span className="flash-news-label-short">Flash</span>
      </div>
      <div className={`flash-news-viewport${needsMarquee ? '' : ' is-static'}`} ref={viewportRef}>
        <div
          className={`flash-news-track${needsMarquee ? ' is-marquee' : ''}`}
          ref={trackRef}
          style={
            needsMarquee && loopWidth > 0
              ? {
                  ['--flash-loop' as string]: `${loopWidth}px`,
                  animationDuration: `${durationSec}s`,
                }
              : undefined
          }
        >
          {Array.from({ length: copies }, (_, copyIndex) =>
            items.map((item) => (
              <div
                key={`${item.id}-c${copyIndex}`}
                className="flash-news-slot"
                data-flash-item="true"
                data-flash-set={copyIndex}
                aria-hidden={copyIndex > 0}
              >
                <FlashItem item={item} />
              </div>
            )),
          )}
        </div>
      </div>
    </aside>
  );
}
