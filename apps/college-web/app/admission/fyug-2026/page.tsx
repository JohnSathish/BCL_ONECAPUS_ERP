import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  MessageCircle,
  PencilLine,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { FyugInterestForm } from '@/components/fyug-interest-form';
import './fyug-interest.css';

export const metadata: Metadata = {
  title: 'FYUG Fourth-Year Honours Interest 2026',
  description:
    'Register interest for admission to the Fourth-Year Undergraduate Honours Programme at Don Bosco College Tura for 2026.',
};

const REGISTRATION_CLOSES = new Date('2026-08-30T23:59:59+05:30');

const eligibilityItems = [
  { label: 'NEHU Affiliated College', icon: ShieldCheck },
  { label: 'Semester V Completed', icon: GraduationCap },
  { label: 'No Back Papers (Sem I–V)', icon: FileText },
  { label: 'Minimum CGPA as per NEHU Norms', icon: Award },
] as const;

const trustItems = [
  "NAAC 'B' Grade Accredited",
  'UGC Recognised',
  'NEHU Affiliated',
  'Experienced Faculty',
  'Placement Assistance',
] as const;

const processSteps = [
  'Interest Registration',
  'Eligibility Verification',
  'Document Upload',
  'Confirmation & Acknowledgement',
] as const;

const stats = [
  { value: '500+', label: 'Seats', icon: Users },
  { value: '12', label: 'Departments', icon: Building2 },
  { value: '4 Years', label: 'Programme', icon: GraduationCap },
  { value: '2026', label: 'Admission', icon: CalendarDays },
] as const;

function daysUntilClose() {
  const ms = REGISTRATION_CLOSES.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function FyugInterestPage() {
  const daysLeft = daysUntilClose();

  return (
    <main id="main" className="fyug-page">
      <header className="fyug-hero">
        <div className="fyug-hero-media" aria-hidden>
          <Image
            src="/images/campus-hero-mobile.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
            className="fyug-hero-photo"
          />
          <div className="fyug-hero-scrim" />
        </div>
        <div className="fyug-hero-waves" aria-hidden>
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path
              fill="#f4f7fb"
              d="M0,40 C320,80 640,0 960,36 C1200,60 1320,70 1440,40 L1440,80 L0,80 Z"
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
              <h1>
                <span className="fyug-hero-title-main">Fourth-Year Honours</span>
                <span className="fyug-hero-title-accent">Interest Registration</span>
              </h1>
              <p className="fyug-hero-lead">
                Register your interest for the Fourth-Year Undergraduate Honours Programme.
              </p>
              <a className="fyug-hero-cta" href="#fyug-form">
                <PencilLine aria-hidden />
                <span>Register Now</span>
                <ChevronRight aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </header>

      <section className="shell fyug-countdown" aria-label="Registration deadline">
        <div className="fyug-countdown-card">
          <div className="fyug-countdown-icon" aria-hidden>
            <Clock3 />
          </div>
          <div className="fyug-countdown-copy">
            <p>Registration closes in</p>
            <strong>30 August 2026</strong>
          </div>
          <div className="fyug-countdown-days">
            <CalendarDays aria-hidden />
            <span>
              {daysLeft === 0
                ? 'Closes today'
                : daysLeft === 1
                  ? '1 day left'
                  : `${daysLeft} days left`}
            </span>
          </div>
        </div>
      </section>

      <section className="shell fyug-stats" aria-label="Programme highlights">
        {stats.map((stat) => (
          <div className="fyug-stat" key={stat.label}>
            <stat.icon aria-hidden />
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="shell fyug-eligibility">
        <div className="fyug-mkt-head">
          <h2>Who can register?</h2>
          <a href="#fyug-form">View details</a>
        </div>
        <p className="fyug-eligibility-intro">
          Bona fide students of any NEHU-affiliated college (including Don Bosco College, Tura)
          currently pursuing the Four-Year Undergraduate Programme under NEP 2020.
        </p>
        <ul className="fyug-elig-grid">
          {eligibilityItems.map((item) => (
            <li key={item.label}>
              <item.icon aria-hidden />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell fyug-trust" aria-label="Why choose Don Bosco College, Tura">
        <h2>Why choose Don Bosco College, Tura?</h2>
        <ul className="fyug-trust-row">
          {trustItems.map((item) => (
            <li key={item}>
              <CheckCircle2 aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell fyug-process" aria-label="Registration process">
        <h2>Registration process</h2>
        <ol className="fyug-process-list">
          {processSteps.map((step, index) => (
            <li key={step}>
              <span className="fyug-process-num" aria-hidden>
                {index + 1}
              </span>
              <span className="fyug-process-label">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="shell fyug-help-band">
        <div className="fyug-help-card">
          <div>
            <p className="fyug-help-kicker">Need help?</p>
            <h2>Contact Admission Office</h2>
          </div>
          <div className="fyug-help-actions">
            <a href="tel:+919402152496">
              <Phone aria-hidden />
              +91 9402152496
            </a>
            <a href="mailto:principal@donboscocollege.ac.in">principal@donboscocollege.ac.in</a>
          </div>
        </div>
      </section>

      <section className="shell fyug-layout" id="fyug-form">
        <FyugInterestForm />
      </section>

      <div className="fyug-sticky-cta" role="region" aria-label="Quick registration actions">
        <a className="fyug-sticky-side" href="tel:+919402152496">
          <Phone aria-hidden />
          <span>Contact</span>
        </a>
        <a className="fyug-sticky-main" href="#fyug-form">
          <PencilLine aria-hidden />
          <span>Register Now</span>
        </a>
        <a
          className="fyug-sticky-side fyug-sticky-wa"
          href="https://wa.me/919402152496"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle aria-hidden />
          <span>Chat</span>
        </a>
      </div>
    </main>
  );
}
