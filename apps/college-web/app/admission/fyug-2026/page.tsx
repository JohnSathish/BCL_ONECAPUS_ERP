import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock3, GraduationCap, Phone } from 'lucide-react';
import { FyugInterestForm } from '@/components/fyug-interest-form';
import './fyug-interest.css';

export const metadata: Metadata = {
  title: 'FYUG Fourth-Year Honours Interest 2026',
  description:
    'Register interest for admission to the Fourth-Year Undergraduate Honours Programme at Don Bosco College Tura for 2026.',
};

const eligibilityItems = [
  'NEHU Affiliated College',
  'Semester V completed successfully',
  'No Back Papers (Semester I–V)',
  'FYUP (NEP 2020)',
] as const;

export default function FyugInterestPage() {
  return (
    <main id="main" className="fyug-page">
      <header className="fyug-hero">
        <div className="fyug-hero-waves" aria-hidden>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path
              fill="rgba(255,255,255,0.08)"
              d="M0,64 C240,120 480,0 720,40 C960,80 1200,120 1440,48 L1440,120 L0,120 Z"
            />
            <path
              fill="rgba(244,180,0,0.12)"
              d="M0,80 C320,20 640,100 960,60 C1120,40 1280,20 1440,70 L1440,120 L0,120 Z"
            />
          </svg>
        </div>
        <div className="shell fyug-hero-inner">
          <nav className="fyug-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/admission/apply">Admission</Link>
            <span aria-hidden>/</span>
            <span>FYUG 2026</span>
          </nav>

          <div className="fyug-hero-grid">
            <div className="fyug-hero-copy">
              <p className="fyug-session-badge">Academic Session 2026 · NEP 2020</p>
              <h1>Fourth-Year Honours Interest Registration</h1>
              <p className="fyug-hero-lead">
                Register your interest for the Fourth-Year Undergraduate Honours Programme.
              </p>
              <p className="fyug-deadline">
                <Clock3 aria-hidden />
                <span>
                  Registration closes on <strong>30 August 2026</strong>
                </span>
              </p>
              <a className="fyug-hero-cta" href="#fyug-form">
                Register Now
              </a>
            </div>
            <div className="fyug-hero-art" aria-hidden>
              <span className="fyug-hero-orb" />
              <GraduationCap className="fyug-hero-cap" />
            </div>
          </div>
        </div>
      </header>

      <section className="shell fyug-eligibility">
        <div className="fyug-eligibility-card">
          <div className="fyug-eligibility-main">
            <p className="fyug-eligibility-kicker">Eligible Students</p>
            <h2>Who can register</h2>
            <p>
              Bona fide students of any NEHU-affiliated college (including Don Bosco College, Tura)
              currently pursuing the Four-Year Undergraduate Programme under NEP 2020.
            </p>
            <ul className="fyug-check-list">
              {eligibilityItems.map((item) => (
                <li key={item}>
                  <CheckCircle2 aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="fyug-eligibility-help">
            <p className="fyug-eligibility-help-title">Need help?</p>
            <p>Contact Admission Office</p>
            <a href="tel:+919402152496">
              <Phone aria-hidden />
              +91 9402152496
            </a>
            <a href="mailto:principal@donboscocollege.ac.in">principal@donboscocollege.ac.in</a>
          </aside>
        </div>
      </section>

      <section className="shell fyug-layout" id="fyug-form">
        <FyugInterestForm />
      </section>
    </main>
  );
}
