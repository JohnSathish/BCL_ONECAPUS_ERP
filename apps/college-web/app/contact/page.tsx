import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  Send,
} from 'lucide-react';
import { ContactForm } from '@/components/contact-form';
import { getCollegeContent } from '@/lib/content';
import './contact.css';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact Don Bosco College, Tura for admissions, campus visits and general enquiries.',
};

const quickLinks = [
  { label: 'Apply for admission', href: '/admission/apply', Icon: GraduationCap },
  { label: 'Explore programmes', href: '/academics/programmes', Icon: BookOpen },
  { label: 'About the college', href: '/about/history', Icon: Building2 },
  { label: 'Notice board', href: '/news', Icon: HelpCircle },
] as const;

const helpActions = [
  {
    title: 'Visit Campus',
    copy: 'Schedule a guided walk through our facilities.',
    cta: 'Book a Visit',
    Icon: MapPin,
    kind: 'visit' as const,
  },
  {
    title: 'Admissions Help',
    copy: 'Get guidance on programmes, eligibility and dates.',
    cta: 'Contact Admissions',
    Icon: GraduationCap,
    kind: 'admissions' as const,
  },
  {
    title: 'General Enquiries',
    copy: 'Reach the college office for day-to-day questions.',
    cta: 'Call the Office',
    Icon: Phone,
    kind: 'phone' as const,
  },
  {
    title: 'Write to Us',
    copy: 'Prefer email? Send your message to our inbox.',
    cta: 'Email College',
    Icon: Send,
    kind: 'email' as const,
  },
];

function helpHref(kind: (typeof helpActions)[number]['kind'], email: string, phone: string) {
  switch (kind) {
    case 'visit':
      return `mailto:${email}?subject=${encodeURIComponent('Campus visit')}`;
    case 'admissions':
      return '/admission/apply';
    case 'phone':
      return `tel:${phone.replace(/\s+/g, '')}`;
    case 'email':
      return `mailto:${email}`;
  }
}

export default async function ContactPage() {
  const content = await getCollegeContent();
  const footer = content.homepageCms.footer;
  const address = footer.address.replace(/\n+/g, ', ');
  const officeHours = footer.officeHours ?? 'Mon - Sat: 9:00 AM - 4:30 PM';
  const mapQuery = encodeURIComponent('Don Bosco College, Tura, Meghalaya');

  return (
    <main id="main" className="contact-page">
      <header className="contact-hero">
        <div className="shell contact-hero-inner">
          <nav className="contact-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>Contact Us</span>
          </nav>
          <p className="contact-hero-brand">Don Bosco College Tura</p>
          <h1>Contact Us</h1>
          <p className="contact-hero-lead">
            We are here to help and answer any question you might have.
          </p>
        </div>
      </header>

      <section className="shell contact-layout">
        <ContactForm />

        <aside className="contact-aside">
          <div className="contact-quick">
            <h2>Quick Links</h2>
            <ul>
              {quickLinks.map(({ label, href, Icon }) => (
                <li key={href}>
                  <Link href={href}>
                    <span className="contact-quick-icon" aria-hidden>
                      <Icon />
                    </span>
                    <span>{label}</span>
                    <ChevronRight aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="contact-touch">
            <h2>Get in Touch</h2>
            <ul>
              <li>
                <MapPin aria-hidden />
                <div>
                  <strong>Address</strong>
                  <p>{address}</p>
                </div>
              </li>
              <li>
                <Phone aria-hidden />
                <div>
                  <strong>Phone</strong>
                  <p>
                    <a href={`tel:${footer.contactPhone.replace(/\s+/g, '')}`}>
                      {footer.contactPhone}
                    </a>
                  </p>
                  <p>{officeHours}</p>
                </div>
              </li>
              <li>
                <Mail aria-hidden />
                <div>
                  <strong>Email</strong>
                  <p>
                    <a href={`mailto:${footer.contactEmail}`}>{footer.contactEmail}</a>
                  </p>
                </div>
              </li>
              <li>
                <Clock3 aria-hidden />
                <div>
                  <strong>Office Hours</strong>
                  <p>{officeHours}</p>
                </div>
              </li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="shell contact-lower">
        <div className="contact-help-grid">
          {helpActions.map(({ title, copy, cta, Icon, kind }) => (
            <article key={title} className="contact-help-card">
              <span className="contact-help-icon" aria-hidden>
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <a href={helpHref(kind, footer.contactEmail, footer.contactPhone)}>
                {cta} <ArrowRight aria-hidden />
              </a>
            </article>
          ))}
        </div>

        <div className="contact-map">
          <div className="contact-map-copy">
            <CalendarDays aria-hidden />
            <div>
              <h2>Find us on the map</h2>
              <p>Don Bosco College, Tura — West Garo Hills, Meghalaya.</p>
            </div>
          </div>
          <div className="contact-map-frame">
            <iframe
              title="Don Bosco College Tura location map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
