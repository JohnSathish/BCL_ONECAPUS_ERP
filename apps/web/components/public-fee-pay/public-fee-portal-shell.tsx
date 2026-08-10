'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  FileText,
  HelpCircle,
  Home,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import './public-fee-pay.css';

const ACADEMIC_SESSION = '2026 – 2027';

const NAV = [
  {
    href: '/public-fee-pay',
    label: 'Home',
    icon: Home,
    match: (p: string) => p === '/public-fee-pay',
  },
  {
    href: '/public-fee-pay/verify',
    label: 'Verify Receipt',
    icon: FileText,
    match: (p: string) => p.startsWith('/public-fee-pay/verify'),
  },
  { href: '/public-fee-pay#help', label: 'Help', icon: HelpCircle, match: () => false },
  { href: '/public-fee-pay#contact', label: 'Contact', icon: Phone, match: () => false },
] as const;

export function PublicFeePortalShell({
  children,
  activeStep,
}: {
  children: ReactNode;
  activeStep?: 1 | 2 | 3 | 4 | 5;
}) {
  const pathname = usePathname() || '/public-fee-pay';

  return (
    <div className="pfp-portal">
      <header className="pfp-hero">
        <div className="pfp-hero-watermark" aria-hidden />
        <div className="pfp-hero-inner">
          <div className="pfp-hero-brand">
            <Image
              src="/branding/basecode-labs-logo.png"
              alt="Don Bosco College Tura"
              width={88}
              height={88}
              className="pfp-hero-logo"
              priority
            />
            <h1>Don Bosco College, Tura</h1>
            <p>Affiliated to North Eastern Hill University (NEHU), Shillong</p>
            <p>Tura, West Garo Hills, Meghalaya – 794002</p>
            <p className="pfp-motto">In Pursuit of Excellence</p>
          </div>

          <div className="pfp-trust-row">
            <span className="pfp-badge pfp-badge-official">
              <BadgeCheck size={14} aria-hidden /> Official College Portal
            </span>
            <span className="pfp-badge pfp-badge-session">
              <BookOpen size={14} aria-hidden /> Academic Session: {ACADEMIC_SESSION}
            </span>
            <span className="pfp-badge pfp-badge-secure">
              <Lock size={14} aria-hidden /> Secure Payment | SSL Secured | Powered by BaseCode Labs
            </span>
          </div>

          <div className="pfp-portal-bar">Official Online Fee Payment Portal</div>
        </div>
      </header>

      <nav className="pfp-nav" aria-label="Fee payment portal">
        <div className="pfp-nav-inner">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link key={item.href} href={item.href} className={active ? 'is-active' : undefined}>
                <Icon size={15} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="pfp-main">
        {activeStep ? (
          <ol className="pfp-steps" aria-label="Payment steps">
            {[
              'Search Student',
              'Verify Details',
              'Select Fees',
              'Pay Securely',
              'Download Receipt',
            ].map((label, idx) => {
              const n = (idx + 1) as 1 | 2 | 3 | 4 | 5;
              const done = activeStep > n;
              const active = activeStep === n;
              return (
                <li
                  key={label}
                  className={`pfp-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                >
                  <strong>
                    {done ? '✓' : n}. {label}
                  </strong>
                </li>
              );
            })}
          </ol>
        ) : null}

        <aside className="pfp-notice" aria-label="Official notice">
          <ShieldCheck size={22} aria-hidden />
          <div>
            <h2>Official Notice</h2>
            <ul>
              <li>No ERP login or password is required.</li>
              <li>Enter only your Roll Number / Registration Number to continue.</li>
              <li>Payments are processed securely through the college gateway.</li>
              <li>An official digital receipt will be generated after payment.</li>
            </ul>
          </div>
        </aside>

        {children}

        <section className="pfp-secure-strip" aria-label="Safe and secure payment">
          {[
            'SSL Encrypted',
            'Official College Payment Gateway',
            'Instant Receipt Generation',
            'UPI • Cards • Net Banking',
            'QR Verification',
          ].map((text) => (
            <div key={text} className="pfp-secure-item">
              <CheckCircle2 size={16} aria-hidden style={{ display: 'inline', marginBottom: 4 }} />
              <div>{text}</div>
            </div>
          ))}
        </section>
      </main>

      <footer className="pfp-footer" id="contact">
        <div className="pfp-footer-inner">
          <div>
            <h4>Don Bosco College, Tura</h4>
            <p>Affiliated to NEHU, Shillong</p>
            <p>Tura, West Garo Hills, Meghalaya – 794002</p>
            <p>
              <Phone size={13} aria-hidden style={{ display: 'inline' }} /> +91 9402152496
            </p>
            <p>
              <Mail size={13} aria-hidden style={{ display: 'inline' }} />{' '}
              office@donboscocollege.ac.in
            </p>
            <p>
              <Building2 size={13} aria-hidden style={{ display: 'inline' }} />{' '}
              <a href="https://donboscocollege.ac.in" target="_blank" rel="noreferrer">
                donboscocollege.ac.in
              </a>
            </p>
          </div>
          <div>
            <h4>About the College</h4>
            <p>
              Don Bosco College, Tura is committed to quality higher education guided by the
              Salesian spirit and the motto “In Pursuit of Excellence.”
            </p>
          </div>
          <div id="help">
            <h4>Secure & Trusted</h4>
            <p>SSL Secured payment environment</p>
            <p>PCI DSS compliant gateway partners</p>
            <p>Official college fee receipts with QR verification</p>
            <p style={{ marginTop: 10 }}>
              Accounts: accounts@donboscocollege.ac.in
              <br />
              Mon–Fri · 9:00 AM – 4:30 PM
            </p>
          </div>
        </div>
        <div className="pfp-footer-bottom">
          <span>© {new Date().getFullYear()} Don Bosco College, Tura. All rights reserved.</span>
          <span>Powered by BaseCode Labs | Version 1.0</span>
        </div>
      </footer>
    </div>
  );
}
