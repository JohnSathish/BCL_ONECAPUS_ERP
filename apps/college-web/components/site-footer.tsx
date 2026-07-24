import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Award, Clock3, Landmark, Mail, MapPin, Phone } from 'lucide-react';
import { NewsletterForm } from '@/components/newsletter-form';
import { VisitorsCount } from '@/components/visitors-count';
import type { HomepageFooterContent, HomepageHeaderCtas } from '@/lib/homepage-cms-content';
import { seedHomepageCmsContent } from '@/lib/homepage-cms-content';
import { getFooterNavigation } from '@/lib/menus';
import { quickLinks } from '@/lib/quick-links';

type Props = {
  footer?: HomepageFooterContent;
  headerCtas?: HomepageHeaderCtas;
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('//');
}

function FooterCtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a className={className} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

function PlayStoreMark() {
  return (
    <svg className="footer-cta-play" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="#EA4335" d="M3.6 2.3c-.4.2-.6.6-.6 1.1v17.2c0 .5.2.9.6 1.1l9.6-9.7L3.6 2.3z" />
      <path fill="#FBBC04" d="M14.7 13.5 12.1 12l-8.5 8.6 11.1-7.1z" />
      <path fill="#4285F4" d="M21.2 10.3 17 7.6l-2.9 2.9 2.9 2.9 4.2-2.7c.7-.4.7-1.4 0-1.8z" />
      <path fill="#34A853" d="M12.1 12 17 7.6 5.9 1.4 12.1 12z" />
    </svg>
  );
}

function uniqueLinks(links: Array<{ label: string; href: string }>) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.href}::${link.label}`;
    if (seen.has(key) || seen.has(link.href)) return false;
    seen.add(key);
    seen.add(link.href);
    return true;
  });
}

function Multiline({ value }: { value: string }) {
  return value.split(/\n+/).map((line) => (
    <span key={line}>
      {line}
      <br />
    </span>
  ));
}

export async function SiteFooter({ footer, headerCtas }: Props) {
  const content = footer ?? seedHomepageCmsContent.footer;
  const ctas = headerCtas ?? seedHomepageCmsContent.headerCtas;
  const cmsFooterNav = await getFooterNavigation();
  const exploreLinks = uniqueLinks(
    cmsFooterNav.length > 0
      ? cmsFooterNav.map((item) => ({ label: item.label, href: item.href }))
      : content.exploreLinks,
  );

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
            <Link key={`${link.label}:${link.href}`} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="footer-quick-links">
          <h3>Quick links</h3>
          {quickLinks.map((link) => (
            <Link key={`${link.label}:${link.href}`} href={link.href}>
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
          <div className="footer-cta-row" aria-label="App and portal links">
            <FooterCtaLink className="footer-cta footer-cta-app" href={ctas.mobileApp.href}>
              <PlayStoreMark />
              <span>{ctas.mobileApp.label}</span>
            </FooterCtaLink>
            <FooterCtaLink className="footer-cta footer-cta-erp" href={ctas.erpLogin.href}>
              <span>{ctas.erpLogin.label}</span>
            </FooterCtaLink>
          </div>
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
