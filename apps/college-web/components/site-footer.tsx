import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Award, Clock3, Landmark, Mail, MapPin, Phone } from 'lucide-react';
import { NewsletterForm } from '@/components/newsletter-form';
import { VisitorsCount } from '@/components/visitors-count';
import type { HomepageFooterContent } from '@/lib/homepage-cms-content';
import { seedHomepageCmsContent } from '@/lib/homepage-cms-content';
import { getFooterNavigation } from '@/lib/menus';
import { quickLinks } from '@/lib/quick-links';

type Props = {
  footer?: HomepageFooterContent;
};

function Multiline({ value }: { value: string }) {
  return value.split(/\n+/).map((line) => (
    <span key={line}>
      {line}
      <br />
    </span>
  ));
}

export async function SiteFooter({ footer }: Props) {
  const content = footer ?? seedHomepageCmsContent.footer;
  const cmsFooterNav = await getFooterNavigation();
  const exploreLinks =
    cmsFooterNav.length > 0
      ? cmsFooterNav.map((item) => ({ label: item.label, href: item.href }))
      : content.exploreLinks;

  const brandTagline = content.brandTagline ?? 'Igniting minds, shaping futures';
  const collegeName = content.collegeName ?? 'Don Bosco College, Tura';
  const officeHours = content.officeHours ?? 'Mon - Sat: 9:00 AM - 4:30 PM';
  const emailNote = content.emailNote ?? "We're here to help";
  const affiliationTitle = content.affiliationTitle ?? 'Affiliated to';
  const affiliationDetail =
    content.affiliationDetail ?? 'North-Eastern Hill University\nShillong - 793 022';
  const accreditationTitle = content.accreditationTitle ?? 'Re-accredited with';
  const accreditationDetail = content.accreditationDetail ?? "'B' Grade by NAAC\nBangalore";

  return (
    <footer className="site-footer">
      <div className="site-footer-glow" aria-hidden />

      <div className="shell footer-identity-wrap">
        <section className="footer-identity" aria-label="College identity and admissions">
          <div className="footer-identity-dots" aria-hidden />

          <div className="footer-identity-brand">
            <div className="footer-identity-logo">
              <Image
                src="/images/college-logo.png"
                alt=""
                width={72}
                height={72}
                priority={false}
              />
            </div>
            <div className="footer-identity-copy">
              <p className="footer-identity-tagline">{brandTagline}</p>
              <h2>{collegeName}</h2>
              <ul className="footer-identity-contacts">
                <li>
                  <MapPin aria-hidden />
                  <span>
                    <Multiline value={content.address} />
                  </span>
                </li>
                <li>
                  <Phone aria-hidden />
                  <span>
                    {content.contactPhone}
                    <br />
                    {officeHours}
                  </span>
                </li>
                <li>
                  <Mail aria-hidden />
                  <span>
                    <a href={`mailto:${content.contactEmail}`}>{content.contactEmail}</a>
                    <br />
                    {emailNote}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-identity-creds">
            <div className="footer-identity-cred">
              <span className="footer-identity-cred-icon" aria-hidden>
                <Landmark />
              </span>
              <div>
                <strong>{affiliationTitle}</strong>
                <p>
                  <Multiline value={affiliationDetail} />
                </p>
              </div>
            </div>
            <div className="footer-identity-cred">
              <span className="footer-identity-cred-icon" aria-hidden>
                <Award />
              </span>
              <div>
                <strong>{accreditationTitle}</strong>
                <p>
                  <Multiline value={accreditationDetail} />
                </p>
              </div>
            </div>
          </div>

          <div className="footer-identity-cta">
            <Link className="footer-identity-cta-primary" href={content.applyHref}>
              {content.ctaTitle} <ArrowRight aria-hidden />
            </Link>
            <p>{content.ctaBody}</p>
            <Link className="footer-identity-cta-link" href={content.applyHref}>
              {content.applyLabel} <ArrowRight aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      <div className="footer-main shell">
        <div className="footer-about">
          <Link className="footer-brand-lockup" href="/" aria-label="Don Bosco College Tura home">
            <Image src="/images/college-logo.png" alt="" width={64} height={64} />
            <span>
              <strong>DON BOSCO COLLEGE</strong>
              <b>TURA</b>
              <em>“In Pursuit of Excellence”</em>
            </span>
          </Link>
          <p className="footer-mission">{content.mission}</p>
          <ul className="footer-badges">
            {content.badges.map((badge) => (
              <li key={badge.label}>
                <strong>{badge.label}</strong>
                <span>{badge.value}</span>
              </li>
            ))}
          </ul>
          <p className="footer-affiliation">{content.affiliation}</p>
          <div className="social">
            {content.socialLinks.map(({ label, href, mark }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
              >
                {mark}
              </a>
            ))}
          </div>
        </div>

        <div className="footer-nav-col">
          <h3>Explore</h3>
          {exploreLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="footer-quick-links">
          <h3>Quick links</h3>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="footer-contact">
          <h3>Contact</h3>
          <p>
            <MapPin aria-hidden /> {content.address.replace(/\n+/g, ', ')}
          </p>
          <p>
            <Phone aria-hidden /> {content.contactPhone}
          </p>
          <p>
            <Mail aria-hidden />{' '}
            <a href={`mailto:${content.contactEmail}`}>{content.contactEmail}</a>
          </p>
          <p>
            <Clock3 aria-hidden /> Office hours: {officeHours}
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="footer-bottom shell">
        <div className="footer-meta">
          <p>
            © {new Date().getFullYear()} {content.copyright}. All rights reserved.
          </p>
          <VisitorsCount />
        </div>
        <p className="developed-by">
          Powered By:{' '}
          <a href="https://basecodelabs.com/" target="_blank" rel="noopener noreferrer">
            BaseCode Labs Pvt. Ltd
          </a>
        </p>
      </div>
    </footer>
  );
}
