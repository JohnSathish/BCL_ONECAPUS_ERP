'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  IndianRupee,
  Landmark,
  Lock,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PoweredByBaseCodeLabs } from '@/components/branding/powered-by-basecode-labs';
import './public-fee-pay.css';

const ACADEMIC_SESSION = '2026 – 2027';

const STEPS = [
  { label: 'Search Student', Icon: Search },
  { label: 'Verify Details', Icon: FileText },
  { label: 'Select Fees', Icon: CreditCard },
  { label: 'Pay Securely', Icon: IndianRupee },
  { label: 'Download Receipt', Icon: FileText },
] as const;

export function PublicFeePortalShell({
  children,
  activeStep,
}: {
  children: ReactNode;
  activeStep?: 1 | 2 | 3 | 4 | 5;
}) {
  const pathname = usePathname() || '/public-fee-pay';
  const onVerify = pathname.startsWith('/public-fee-pay/verify');

  return (
    <div className="pfp-portal">
      <div className="pfp-bg-decor" aria-hidden>
        <span className="pfp-bg-dots" />
        <span className="pfp-bg-swoosh pfp-bg-swoosh-tl" />
        <span className="pfp-bg-swoosh pfp-bg-swoosh-br" />
      </div>

      <header className="pfp-top">
        <div className="pfp-top-inner">
          <div className="pfp-brand-block">
            <Image
              src="/branding/college-logo.png"
              alt="Don Bosco College, Tura"
              width={84}
              height={84}
              className="pfp-college-logo"
              priority
            />
            <div className="pfp-brand-copy">
              <p className="pfp-brand-name">Don Bosco College, Tura</p>
              <p className="pfp-brand-affil">
                Affiliated to North Eastern Hill University (NEHU), Shillong
              </p>
              <p className="pfp-brand-motto">“In Pursuit of Excellence”</p>
              <div className="pfp-trust-row">
                <span className="pfp-badge pfp-badge-official">
                  <BadgeCheck size={14} aria-hidden /> Official College Portal
                </span>
                <span className="pfp-badge pfp-badge-session">
                  <CalendarDays size={14} aria-hidden /> Academic Session: {ACADEMIC_SESSION}
                </span>
                <span className="pfp-badge pfp-badge-secure">
                  <Lock size={14} aria-hidden /> Secure Payment | SSL Secured
                </span>
              </div>
            </div>
          </div>

          <div className="pfp-top-aside">
            <div className="pfp-edu-graphic" aria-hidden>
              <div className="pfp-edu-books">
                <span className="pfp-book pfp-book-a" />
                <span className="pfp-book pfp-book-b" />
                <span className="pfp-book pfp-book-c" />
                <GraduationCap className="pfp-edu-cap" size={36} strokeWidth={1.75} />
              </div>
              <p className="pfp-edu-tagline">
                Education for a <em>Better Tomorrow</em>
              </p>
            </div>
            <Link
              href="/public-fee-pay/verify"
              className={`pfp-verify-link${onVerify ? ' is-active' : ''}`}
            >
              <FileText size={15} aria-hidden /> Verify Receipt
            </Link>
          </div>
        </div>
      </header>

      <div className="pfp-shell">
        <section className="pfp-welcome" aria-label="Welcome">
          <div className="pfp-welcome-icon" aria-hidden>
            <CreditCard size={28} strokeWidth={1.75} />
            <span className="pfp-welcome-rupee">
              <IndianRupee size={14} strokeWidth={2.5} />
            </span>
          </div>
          <div className="pfp-welcome-copy">
            <h1>
              Welcome to the <span>Official Online Fee Payment Portal</span>
            </h1>
            <p>Secure · Fast · Convenient</p>
          </div>
        </section>

        <main className="pfp-main">
          {activeStep ? (
            <ol className="pfp-steps" aria-label="Payment steps">
              {STEPS.map(({ label, Icon }, idx) => {
                const n = (idx + 1) as 1 | 2 | 3 | 4 | 5;
                const done = activeStep > n;
                const active = activeStep === n;
                return (
                  <li
                    key={label}
                    className={`pfp-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                  >
                    <span className="pfp-step-mark" aria-hidden>
                      {done ? <BadgeCheck size={18} /> : <Icon size={18} />}
                    </span>
                    <strong>
                      <span className="pfp-step-num">{n}.</span> {label}
                    </strong>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {children}

          <section className="pfp-features" aria-label="Portal highlights">
            <article>
              <span className="pfp-feature-icon pfp-feature-secure" aria-hidden>
                <ShieldCheck size={20} />
              </span>
              <div>
                <h3>Secure Payment</h3>
                <p>Industry-standard encryption protects every transaction.</p>
              </div>
            </article>
            <article>
              <span className="pfp-feature-icon pfp-feature-fast" aria-hidden>
                <Zap size={20} />
              </span>
              <div>
                <h3>Fast & Convenient</h3>
                <p>Pay anytime, anywhere — no ERP login required.</p>
              </div>
            </article>
            <article>
              <span className="pfp-feature-icon pfp-feature-receipt" aria-hidden>
                <FileText size={20} />
              </span>
              <div>
                <h3>Digital Receipt</h3>
                <p>Instant official receipts with QR verification.</p>
              </div>
            </article>
            <article>
              <span className="pfp-feature-icon pfp-feature-official" aria-hidden>
                <Landmark size={20} />
              </span>
              <div>
                <h3>Official Portal</h3>
                <p>Authorised Don Bosco College, Tura fee gateway.</p>
              </div>
            </article>
          </section>
        </main>
      </div>

      <footer className="pfp-footer" id="contact">
        <div className="pfp-footer-bar">
          <span>© {new Date().getFullYear()} Don Bosco College, Tura. All Rights Reserved.</span>
          <div className="pfp-footer-meta" id="help">
            <a href="tel:+919402152496">
              <Phone size={13} aria-hidden /> +91 9402152496
            </a>
            <a href="mailto:accounts@donboscocollege.ac.in">
              <Mail size={13} aria-hidden /> accounts@donboscocollege.ac.in
            </a>
            <PoweredByBaseCodeLabs />
          </div>
        </div>
      </footer>
    </div>
  );
}
