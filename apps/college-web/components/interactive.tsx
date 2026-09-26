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
import { NavMegaMenu } from '@/components/nav-mega-menu';
import { QuickLinkAnchor, QuickLinkIcon } from '@/components/website-quick-link';
import type { HomepageHeaderCtas } from '@/lib/homepage-cms-content';
import { seedHomepageCmsContent } from '@/lib/homepage-cms-content';
import { listVisibleWebsiteQuickLinks } from '@/lib/website-quick-links';
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
  { label: 'DBC Blood Donors', href: '/blood-donors' },
  { label: 'Contact', href: '/contact' },
];

export function Header({
  navigation = seedNavigation,
  utilityLinks = defaultUtility,
  headerCtas = seedHomepageCmsContent.headerCtas,
}: {
  navigation?: readonly NavGroup[];
  utilityLinks?: readonly UtilityLink[];
  headerCtas?: HomepageHeaderCtas;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const headerLinks = listVisibleWebsiteQuickLinks(headerCtas, 'header');
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
          <div className="utility-meta">
            <span className="utility-aishe">College AISHE Code: C-16361</span>
            <a href="mailto:principal@donboscocollege.ac.in">principal@donboscocollege.ac.in</a>
            <a href="tel:+919402152496">+91 9402152496</a>
          </div>
          <nav aria-label="Utility">
            {utilityLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="brand-bar">
        <div className="shell brand-bar-inner">
          <Link className="brand" href="/" aria-label="Don Bosco College Tura home">
            <Image src="/images/college-logo.png" width={72} height={72} alt="" priority />
            <span>
              <strong>DON BOSCO COLLEGE</strong>
              <b>TURA</b>
              <em>“In Pursuit of Excellence”</em>
            </span>
          </Link>
          <div className="brand-actions">
            {headerLinks.length ? (
              <nav className="brand-quick-links desktop-only" aria-label="Campus access">
                {headerLinks.map(({ key, link }) => (
                  <QuickLinkAnchor
                    key={key}
                    link={link}
                    className={`brand-quick-link brand-quick-link-${key}`}
                  >
                    <QuickLinkIcon linkKey={key} className="brand-quick-link-icon" />
                    <span>{link.label}</span>
                  </QuickLinkAnchor>
                ))}
              </nav>
            ) : null}
            <button
              type="button"
              className="icon-button mobile-menu brand-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
      <div className="nav-bar">
        <div className="shell nav-bar-inner">
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
                  className={active === group.label ? 'is-open' : undefined}
                  aria-expanded={active === group.label}
                  onClick={() => setActive(active === group.label ? null : group.label)}
                >
                  {group.label}
                  <ChevronDown size={14} />
                </button>
                {active === group.label ? (
                  <NavMegaMenu label={group.label} items={group.items} />
                ) : null}
              </div>
            ))}
            <Link href="/iqac">IQAC</Link>
            <Link href="/naac">NAAC</Link>
          </nav>
          <div className="nav-actions desktop-nav-actions">
            <Link className="icon-button" href="/search" aria-label="Search">
              <Search size={19} />
            </Link>
          </div>
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
              <Link href="/iqac" onClick={() => setOpen(false)}>
                IQAC
              </Link>
              <Link href="/naac" onClick={() => setOpen(false)}>
                NAAC
              </Link>
              <Link href="/admission/apply" onClick={() => setOpen(false)}>
                Admissions
              </Link>
              <Link href="/contact" onClick={() => setOpen(false)}>
                Contact
              </Link>
              <Link href="/search" onClick={() => setOpen(false)}>
                Search
              </Link>
              {headerLinks.length ? (
                <div className="drawer-quick-links">
                  {headerLinks.map(({ key, link }) => (
                    <QuickLinkAnchor
                      key={key}
                      link={link}
                      className="drawer-quick-link"
                      onClick={() => setOpen(false)}
                    >
                      <QuickLinkIcon linkKey={key} className="brand-quick-link-icon" />
                      <span>{link.label}</span>
                    </QuickLinkAnchor>
                  ))}
                </div>
              ) : null}
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
          <button
            key={`${image.label}-${image.src}-${i}`}
            onClick={() => setSelected(i)}
            className={`gallery-${i + 1}`}
            type="button"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 700px) 100vw, 33vw"
              unoptimized={
                image.src.startsWith('http') ||
                image.src.startsWith('/uploads/') ||
                image.src.includes('127.0.0.1')
              }
            />
            <span>{image.label}</span>
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Campus gallery">
          <button aria-label="Close gallery" onClick={() => setSelected(null)}>
            <X />
          </button>
          <Image
            src={images[selected].src}
            alt={images[selected].alt}
            fill
            sizes="90vw"
            unoptimized={
              images[selected].src.startsWith('http') ||
              images[selected].src.startsWith('/uploads/') ||
              images[selected].src.includes('127.0.0.1')
            }
          />
        </div>
      )}
    </>
  );
}
