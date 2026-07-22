'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Search, X } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { navigation as seedNavigation } from '@/lib/navigation';

type NewsItem = {
  slug: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  image: string;
};
type NavGroup = { label: string; items: ReadonlyArray<readonly [string, string]> };
type UtilityLink = { label: string; href: string };

const defaultUtility: UtilityLink[] = [
  { label: 'Students', href: '/students' },
  { label: 'Staff', href: '/staff' },
  { label: 'Alumni', href: '/alumni' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

export function Header({
  navigation = seedNavigation,
  utilityLinks = defaultUtility,
}: {
  navigation?: readonly NavGroup[];
  utilityLinks?: readonly UtilityLink[];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
  return (
    <header className="site-header">
      <div className="utility">
        <div className="shell utility-inner">
          <span>UGC Recognised · NAAC ‘B’ Grade</span>
          <nav aria-label="Utility">
            {utilityLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="shell nav-row">
        <Link className="brand" href="/" aria-label="Don Bosco College Tura home">
          <Image src="/images/college-logo.png" width={64} height={64} alt="" priority />
          <span>
            <strong>DON BOSCO COLLEGE</strong>
            <b>TURA</b>
            <em>“In Pursuit of Excellence”</em>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          {navigation.map((group) => (
            <div
              className="nav-group"
              key={group.label}
              onMouseEnter={() => setActive(group.label)}
              onMouseLeave={() => setActive(null)}
            >
              <button
                aria-expanded={active === group.label}
                onClick={() => setActive(active === group.label ? null : group.label)}
              >
                {group.label}
                <ChevronDown size={14} />
              </button>
              {active === group.label && (
                <div className="mega">
                  <p>{group.label}</p>
                  {group.items.map(([label, href]) => (
                    <Link key={href} href={href}>
                      {label}
                      <span>→</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/iqac">IQAC</Link>
          <Link href="/naac">NAAC</Link>
        </nav>
        <div className="nav-actions">
          <Link className="icon-button" href="/search" aria-label="Search">
            <Search size={19} />
          </Link>
          <Button asChild className="compact desktop-only">
            <Link href="/erp">ERP Login</Link>
          </Button>
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
        </div>
      </div>
      <div className="affiliation-bar">
        <div className="shell">
          <p>Affiliated to the North-Eastern Hill University, Shillong – 793 002</p>
          <p>Recognised by University Grants Commission (UGC), New Delhi</p>
          <p>(Re-accredited with &apos;B&apos; Grade by NAAC, Bangalore)</p>
        </div>
      </div>
      {open &&
        createPortal(
          <>
            <div
              className="drawer-backdrop"
              style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}
            />
            <aside
              className="drawer"
              style={{
                position: 'fixed',
                inset: '0 0 0 auto',
                zIndex: 10000,
                pointerEvents: 'auto',
              }}
              aria-label="Mobile navigation"
            >
              <button
                className="drawer-close"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
              <Link className="drawer-brand" href="/" onClick={() => setOpen(false)}>
                Don Bosco College Tura
              </Link>
              <Accordion type="single" collapsible>
                {navigation.map((group) => (
                  <AccordionItem value={group.label} key={group.label}>
                    <AccordionTrigger>{group.label}</AccordionTrigger>
                    <AccordionContent>
                      {group.items.map(([label, href]) => (
                        <Link href={href} key={href} onClick={() => setOpen(false)}>
                          {label}
                        </Link>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Link href="/iqac">IQAC</Link>
              <Link href="/naac">NAAC</Link>
              <Button asChild variant="gold">
                <Link href="/admission/apply">Apply now</Link>
              </Button>
            </aside>
          </>,
          document.body,
        )}
    </header>
  );
}

export function NewsSlider({ items }: { items: NewsItem[] }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!embla) return;
    const select = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', select);
    select();
    return () => {
      embla.off('select', select);
    };
  }, [embla]);
  return (
    <div className="carousel-viewport" ref={emblaRef}>
      <div className="carousel-container">
        {items.map((item) => (
          <article className="carousel-slide news-slider" key={item.slug}>
            <div className="news-image">
              <Image src={item.image} alt="" fill sizes="(max-width: 800px) 100vw, 48vw" />
            </div>
            <div className="news-copy">
              <span className="eyebrow">
                {item.category} ·{' '}
                {new Date(item.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
              <Link className="text-link" href={`/news/${item.slug}`}>
                Read story →
              </Link>
              <div className="slider-controls">
                <button aria-label="Previous story" onClick={() => embla?.scrollPrev()}>
                  <ChevronLeft />
                </button>
                <span>
                  {index + 1} / {items.length}
                </span>
                <button aria-label="Next story" onClick={() => embla?.scrollNext()}>
                  <ChevronRight />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function TestimonialSlider({
  items,
}: {
  items: { quote: string; name: string; role: string }[];
}) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!embla) return;
    const select = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', select);
    select();
    return () => {
      embla.off('select', select);
    };
  }, [embla]);
  return (
    <div>
      <div className="carousel-viewport" ref={emblaRef}>
        <div className="carousel-container">
          {items.map((item) => (
            <div className="carousel-slide testimonial" key={item.name}>
              <span className="quote-mark">“</span>
              <blockquote>{item.quote}</blockquote>
              <p>
                <strong>{item.name}</strong>
                <small>{item.role}</small>
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="dots">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => embla?.scrollTo(i)}
            className={i === index ? 'active' : ''}
            aria-label={`Show testimonial ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export function Gallery({ images }: { images: { src: string; alt: string; label: string }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <div className="gallery-grid">
        {images.map((image, i) => (
          <button key={image.src} onClick={() => setSelected(i)} className={`gallery-${i + 1}`}>
            <Image src={image.src} alt={image.alt} fill sizes="(max-width: 700px) 100vw, 33vw" />
            <span>{image.label}</span>
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Campus gallery">
          <button aria-label="Close gallery" onClick={() => setSelected(null)}>
            <X />
          </button>
          <Image src={images[selected].src} alt={images[selected].alt} fill sizes="90vw" />
        </div>
      )}
    </>
  );
}
