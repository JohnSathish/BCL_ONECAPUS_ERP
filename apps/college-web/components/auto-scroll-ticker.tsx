'use client';

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type AutoScrollTickerProps = {
  children: ReactNode;
  label: string;
  /** Pixels scrolled per second for the marquee. */
  speedPx?: number;
  resumeDelayMs?: number;
  className?: string;
  /** @deprecated Kept for call-site compatibility; marquee uses speedPx instead. */
  intervalMs?: number;
};

export function AutoScrollTicker({
  children,
  label,
  speedPx = 28,
  resumeDelayMs = 900,
  className = '',
}: AutoScrollTickerProps) {
  const items = Children.toArray(children);
  const count = items.length;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [loopHeight, setLoopHeight] = useState(0);
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
    }, resumeDelayMs);
  }, [resumeDelayMs]);

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
      const nodes = track.querySelectorAll<HTMLElement>('[data-ticker-item="true"]');
      if (nodes.length < count || count === 0) {
        setLoopHeight(0);
        return;
      }
      let height = 0;
      for (let i = 0; i < count; i += 1) {
        height += nodes[i].getBoundingClientRect().height;
      }
      setLoopHeight(height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [count]);

  useEffect(() => () => clearResume(), []);

  if (!count) return null;

  if (reducedMotion || count === 1) {
    return (
      <div className={`info-ticker info-ticker-static ${className}`.trim()} aria-label={label}>
        <div className="info-ticker-viewport info-ticker-scroll">
          <ul className="info-ticker-track">
            {items.map((item, itemIndex) => (
              <li key={`static-${itemIndex}`} data-ticker-item="true" className="info-ticker-item">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const durationSec = loopHeight > 0 ? Math.max(12, loopHeight / speedPx) : 24;

  return (
    <div
      className={`info-ticker info-ticker-marquee${paused ? ' is-paused' : ''} ${className}`.trim()}
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
      <div className="info-ticker-viewport">
        <div
          className="info-ticker-track is-marquee"
          ref={trackRef}
          style={
            loopHeight > 0
              ? {
                  ['--ticker-loop' as string]: `${loopHeight}px`,
                  animationDuration: `${durationSec}s`,
                }
              : undefined
          }
        >
          {[...items, ...items].map((item, itemIndex) => (
            <div
              key={`slide-${itemIndex}`}
              data-ticker-item="true"
              className="info-ticker-item"
              aria-hidden={itemIndex >= count}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
