'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fallbackHeroSlides, type HeroSlide } from '@/lib/hero-slide-types';

const AUTOPLAY_MS = 6500;

type HeroSliderProps = {
  slides: HeroSlide[];
};

export function HeroSlider({ slides }: HeroSliderProps) {
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());

  const resolvedSlides = useMemo(() => {
    const source = slides.length ? slides : fallbackHeroSlides;
    const mapped = source.map((slide, index) => {
      if (!brokenIds.has(slide.id)) return slide;
      const fallback = fallbackHeroSlides[index % fallbackHeroSlides.length];
      return {
        ...slide,
        desktopSrc: fallback.desktopSrc,
        mobileSrc: fallback.mobileSrc,
        alt: slide.alt || fallback.alt,
      };
    });
    return mapped.length ? mapped : fallbackHeroSlides;
  }, [slides, brokenIds]);

  const count = resolvedSlides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (count <= 1) return;
      setIndex((current) => {
        if (next < 0) return count - 1;
        if (next >= count) return 0;
        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (!count) return null;

  return (
    <div
      className="hero-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label="Campus highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {resolvedSlides.map((slide, slideIndex) => (
        <div
          key={slide.id}
          className={`hero-slide${slideIndex === index ? ' is-active' : ''}`}
          aria-hidden={slideIndex !== index}
        >
          <picture>
            {slide.mobileSrc ? (
              <source media="(max-width: 760px)" srcSet={slide.mobileSrc} />
            ) : null}
            <img
              src={slide.desktopSrc}
              alt={slide.alt}
              fetchPriority={slideIndex === 0 ? 'high' : 'low'}
              loading={slideIndex === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onError={() => {
                if (fallbackHeroSlides.some((item) => item.desktopSrc === slide.desktopSrc)) {
                  return;
                }
                setBrokenIds((current) => {
                  if (current.has(slide.id)) return current;
                  const next = new Set(current);
                  next.add(slide.id);
                  return next;
                });
              }}
            />
          </picture>
        </div>
      ))}

      {count > 1 ? (
        <>
          <div className="hero-slider-controls" aria-hidden={false}>
            <button
              type="button"
              className="hero-slider-arrow"
              aria-label="Previous slide"
              onClick={() => goTo(index - 1)}
            >
              <ChevronLeft aria-hidden />
            </button>
            <button
              type="button"
              className="hero-slider-arrow"
              aria-label="Next slide"
              onClick={() => goTo(index + 1)}
            >
              <ChevronRight aria-hidden />
            </button>
          </div>

          <div className="hero-slider-dots" role="tablist" aria-label="Choose slide">
            {resolvedSlides.map((slide, dotIndex) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                className={dotIndex === index ? 'active' : ''}
                aria-label={`Show slide ${dotIndex + 1} of ${count}`}
                aria-selected={dotIndex === index}
                onClick={() => goTo(dotIndex)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
