'use client';

import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HomepageSisterInstitutions } from '@/lib/homepage-cms-content';
import { absolutizeMediaUrl } from '@/lib/media-url';

type Props = {
  content: HomepageSisterInstitutions;
};

export function SisterInstitutions({ content }: Props) {
  const items = content.items.filter((item) => item.logoUrl || item.name);
  const [emblaRef, embla] = useEmblaCarousel({
    loop: items.length > 3,
    align: 'start',
    slidesToScroll: 1,
  });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    onSelect();
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla]);

  if (!items.length) return null;

  return (
    <section className="sister-institutions" aria-labelledby="sister-institutions-heading">
      <div className="shell sister-institutions-inner">
        <header className="sister-institutions-head">
          <h2 id="sister-institutions-heading">{content.title}</h2>
          {content.subtitle ? <p>{content.subtitle}</p> : null}
          <span className="sister-institutions-rule" aria-hidden />
        </header>

        <div className="sister-institutions-viewport" ref={emblaRef}>
          <div className="sister-institutions-track">
            {items.map((item) => {
              const logoSrc = absolutizeMediaUrl(item.logoUrl) || item.logoUrl;
              const card = (
                <span className="sister-institutions-logo">
                  {logoSrc ? (
                    <Image
                      src={logoSrc}
                      alt={item.name || 'Sister institution'}
                      width={140}
                      height={90}
                      unoptimized
                    />
                  ) : (
                    <strong>{item.name || 'Institution'}</strong>
                  )}
                </span>
              );
              return (
                <div className="sister-institutions-slide" key={item.id}>
                  {item.href ? (
                    <a
                      className="sister-institutions-card"
                      href={item.href}
                      title={item.name || undefined}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {card}
                    </a>
                  ) : (
                    <div className="sister-institutions-card" title={item.name || undefined}>
                      {card}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {items.length > 1 ? (
          <div className="sister-institutions-controls">
            <button
              type="button"
              aria-label="Previous institutions"
              onClick={() => embla?.scrollPrev()}
            >
              <ChevronLeft />
            </button>
            <div
              className="sister-institutions-dots"
              role="tablist"
              aria-label="Sister institution slides"
            >
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={i === index ? 'is-active' : undefined}
                  aria-label={`Show ${item.name || `logo ${i + 1}`}`}
                  onClick={() => embla?.scrollTo(i)}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next institutions"
              onClick={() => embla?.scrollNext()}
            >
              <ChevronRight />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
