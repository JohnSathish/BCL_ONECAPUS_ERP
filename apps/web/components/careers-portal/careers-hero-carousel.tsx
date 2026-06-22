'use client';

import { useEffect, useState } from 'react';
import { HERO_CAROUSEL_SLIDES } from '@/lib/careers-portal/constants';
import { cn } from '@/utils/cn';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';

type Slide = { id: string; label: string; src: string };

export function CareersHeroCarousel({ heroImages }: { heroImages?: string[] }) {
  const slides: Slide[] =
    heroImages && heroImages.length > 0
      ? heroImages.map((src, i) => ({
          id: `hero-${i}`,
          label: 'Don Bosco College Tura',
          src: resolveUploadAssetUrl(src) ?? src,
        }))
      : HERO_CAROUSEL_SLIDES.map((s) => ({ id: s.id, label: s.label, src: s.src }));

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[active] ?? slides[0]!;

  return (
    <div className="relative h-full min-h-[208px] w-full lg:min-h-full">
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-1000',
            i === active ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} alt={s.label} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#0a1628]/60 lg:to-[#0a1628]/40" />
        </div>
      ))}

      {slides.length > 1 ? (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2 lg:bottom-8">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show ${s.label}`}
              onClick={() => setActive(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === active ? 'w-8 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70',
              )}
            />
          ))}
        </div>
      ) : null}
      <span className="sr-only">{slide.label}</span>
    </div>
  );
}
