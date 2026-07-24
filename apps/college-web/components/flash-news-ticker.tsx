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

export function FlashNewsTicker({ items, label = 'Announcements' }: Props) {
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
    if (!track) return;
    const measure = () => {
      const nodes = track.querySelectorAll<HTMLElement>('[data-flash-item="true"]');
      if (nodes.length < items.length || !items.length) {
        setLoopWidth(0);
        return;
      }
      let width = 0;
      for (let i = 0; i < items.length; i += 1) {
        width += nodes[i].getBoundingClientRect().width;
      }
      // include gaps between items (28px each)
      width += Math.max(0, items.length) * 28;
      setLoopWidth(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => () => clearResume(), []);

  if (!items.length) return null;

  if (reducedMotion || items.length === 1) {
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

  const durationSec = loopWidth > 0 ? Math.max(18, loopWidth / 42) : 28;
  const loop = [...items, ...items];

  return (
    <aside
      className={`flash-news-bar${paused ? ' is-paused' : ''}`}
      aria-label={label}
      onMouseEnter={pause}
      onMouseLeave={scheduleResume}
      onFocusCapture={pause}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleResume();
        }
      }}
      onTouchStart={pause}
      onTouchEnd={scheduleResume}
    >
      <div className="flash-news-label">
        <Megaphone aria-hidden />
        <span className="flash-news-label-full">Announcements</span>
        <span className="flash-news-label-short">Flash</span>
      </div>
      <div className="flash-news-viewport">
        <div
          className="flash-news-track is-marquee"
          ref={trackRef}
          style={
            loopWidth > 0
              ? {
                  ['--flash-loop' as string]: `${loopWidth}px`,
                  animationDuration: `${durationSec}s`,
                }
              : undefined
          }
        >
          {loop.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flash-news-slot"
              data-flash-item="true"
              aria-hidden={index >= items.length}
            >
              <FlashItem item={item} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
