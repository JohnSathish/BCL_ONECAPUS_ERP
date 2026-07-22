'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { initialsFromName, testimonialRoleLine, type Testimonial } from '@/lib/testimonials';

const PREVIEW_CHARS = 160;

const tones = ['blue', 'cream', 'green', 'lilac', 'sand'] as const;

type Props = {
  items: Testimonial[];
};

function Stars({ value = 5 }: { value?: number }) {
  const capped = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <p className="voices-stars" aria-label={`${capped} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          className={index < capped ? 'is-filled' : undefined}
          fill={index < capped ? 'currentColor' : 'none'}
        />
      ))}
    </p>
  );
}

function TestimonialCard({ item, tone }: { item: Testimonial; tone: (typeof tones)[number] }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const needsToggle = item.quote.length > PREVIEW_CHARS;
  const preview = needsToggle
    ? `${item.quote
        .slice(0, PREVIEW_CHARS)
        .replace(/\s+\S*$/, '')
        .trim()}…`
    : item.quote;
  const cardClass = [
    'voices-card',
    `voices-card-${tone}`,
    expanded ? 'is-expanded' : 'is-collapsed',
  ].join(' ');
  const initials = initialsFromName(item.name);

  return (
    <article className={cardClass}>
      <span className="voices-quote-icon" aria-hidden>
        “
      </span>
      <div className="voices-card-body">
        <div className="voices-avatar" aria-hidden={!item.photoSrc}>
          {item.photoSrc ? (
            <Image src={item.photoSrc} alt={item.photoAlt || item.name} width={72} height={72} />
          ) : (
            <span className="voices-avatar-initials">{initials}</span>
          )}
        </div>
        <div className="voices-copy">
          <blockquote id={panelId}>{expanded || !needsToggle ? item.quote : preview}</blockquote>
          {needsToggle ? (
            <button
              type="button"
              className="voices-read-more"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
          <Stars value={item.rating ?? 5} />
          <div className="voices-meta">
            <strong>{item.name}</strong>
            <span>{testimonialRoleLine(item)}</span>
            {item.status ? <em>{item.status}</em> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function VoicesOfBosco({ items }: Props) {
  const [emblaRef, embla] = useEmblaCarousel({
    loop: true,
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
    <section className="voices section shell" aria-labelledby="voices-heading">
      <div className="voices-head">
        <div>
          <span className="eyebrow gold">Voices of Bosco</span>
          <h2 id="voices-heading" className="display">
            Stories that stay with us
          </h2>
          <p className="voices-intro">
            Real experiences from our students and alumni who have grown, learned and achieved with
            us.
          </p>
        </div>
        <div className="voices-nav" aria-label="Testimonial controls">
          <button
            type="button"
            aria-label="Previous testimonials"
            onClick={() => embla?.scrollPrev()}
          >
            <ChevronLeft />
          </button>
          <button type="button" aria-label="Next testimonials" onClick={() => embla?.scrollNext()}>
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="voices-viewport" ref={emblaRef}>
        <div className="voices-track">
          {items.map((item, itemIndex) => (
            <div className="voices-slide" key={item.id}>
              <TestimonialCard item={item} tone={tones[itemIndex % tones.length]} />
            </div>
          ))}
        </div>
      </div>

      <div className="voices-dots" role="tablist" aria-label="Testimonial slides">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={i === index ? 'is-active' : undefined}
            aria-label={`Show testimonial ${i + 1}`}
            onClick={() => embla?.scrollTo(i)}
          />
        ))}
      </div>

      <ul className="voices-stats" aria-label="Community highlights">
        <li>
          <Users aria-hidden />
          <div>
            <strong>98%</strong>
            <span>Student satisfaction</span>
          </div>
        </li>
        <li>
          <GraduationCap aria-hidden />
          <div>
            <strong>4500+</strong>
            <span>Alumni worldwide</span>
          </div>
        </li>
        <li>
          <BriefcaseBusiness aria-hidden />
          <div>
            <strong>92%</strong>
            <span>Placement support</span>
          </div>
        </li>
        <li>
          <Trophy aria-hidden />
          <div>
            <strong>38+</strong>
            <span>Years of excellence</span>
          </div>
        </li>
      </ul>

      <div className="voices-cta">
        <p>
          <Building2 aria-hidden />
          Be a part of the Bosco family.
        </p>
        <Link className="button gold-button" href="/admission/apply">
          Join the journey <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}
