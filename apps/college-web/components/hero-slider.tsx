'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HeroSlide } from '@/lib/hero-slides';

const AUTOPLAY_MS = 6500;

type HeroSliderProps = {
  slides: HeroSlide[];
};

export function HeroSlider({ slides }: HeroSliderProps) {
  const count = slides.length;
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
      {slides.map((slide, slideIndex) => (
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
            {slides.map((slide, dotIndex) => (
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
