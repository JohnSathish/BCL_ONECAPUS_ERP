import Link from 'next/link';
import { Building2, Heart, Mail, MapPin, Phone } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { NewsletterForm } from '@/components/public/newsletter-form';
import { CopyrightYear } from '@/components/public/copyright-year';
import { COMPANY, NAV } from '@/lib/company';

export function SiteFooter({ visitors }: { visitors?: number | null }) {
  return (
    <footer className="bg-[#020b18] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.7fr_0.7fr_1fr_0.75fr_1.2fr]">
          <div>
            <div className="flex items-center gap-3 text-white">
              <BrandLogo size={56} />
              <div>
                <strong className="block text-sm">{COMPANY.legalName}</strong>
                <span className="text-xs text-cyan-300">{COMPANY.tagline}</span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
              Technology growth partner for schools, colleges, dioceses and businesses in Tamil
              Nadu, Meghalaya and across India.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li>
                <a
                  className="inline-flex items-center gap-2 hover:text-white"
                  href={`mailto:${COMPANY.email}`}
                >
                  <Mail className="h-4 w-4 text-cyan-400" />
                  {COMPANY.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span>
                  <a className="hover:text-white" href={`tel:+91${COMPANY.phones[0]}`}>
                    {COMPANY.phoneDisplay}
                  </a>
                  {' / '}
                  <a className="hover:text-white" href={`tel:+91${COMPANY.phones[1]}`}>
                    +91 87784 63459
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span>
                  {COMPANY.operationalOffice.line1}, {COMPANY.operationalOffice.line2}
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV.filter((item) =>
                ['/', '/about', '/products', '/services', '/industries', '/contact'].includes(
                  item.href,
                ),
              ).map((item) => (
                <li key={item.href}>
                  <Link className="hover:text-white" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Resources</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link className="hover:text-white" href="/portfolio">
                  Portfolio
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/testimonials">
                  Clients
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/blog">
                  Blog
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/case-studies">
                  Case Studies
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/portal/login">
                  Client Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Offices</h3>
            <div className="mt-4 space-y-4 text-sm leading-6">
              <p className="flex gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span>
                  <span className="block font-medium text-white">
                    {COMPANY.registeredOffice.name}
                  </span>
                  {COMPANY.registeredOffice.line1}
                  <br />
                  {COMPANY.registeredOffice.line2}
                </span>
              </p>
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span>
                  <span className="block font-medium text-white">
                    {COMPANY.operationalOffice.name}
                  </span>
                  {COMPANY.operationalOffice.line1}
                  <br />
                  {COMPANY.operationalOffice.line2}
                </span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link className="font-semibold text-cyan-300 hover:text-white" href="/legal">
                  Legal &amp; Policies →
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/privacy-policy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/terms">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/software-license">
                  Software License
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/refund-policy">
                  Refund &amp; Cancellation
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/cookie-policy">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/data-security">
                  Security
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/acceptable-use">
                  Acceptable Use
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/legal/disclaimer">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/admin/login">
                  Admin
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Subscribe to Our Updates</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Get the latest news, product updates and insights delivered to your inbox.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row lg:px-6">
          <p>
            © <CopyrightYear /> {COMPANY.legalName} All rights reserved.
            {typeof visitors === 'number' ? (
              <span className="ml-2 text-slate-600">
                Unique visitors: {visitors.toLocaleString('en-IN')}
              </span>
            ) : null}
          </p>
          <p className="hidden tracking-[0.18em] uppercase text-slate-500 md:block">
            Building a brighter tomorrow through technology
          </p>
          <p className="inline-flex items-center gap-1">
            Made with <Heart className="h-3 w-3 fill-red-500 text-red-500" /> in India
          </p>
        </div>
      </div>
    </footer>
  );
}
