import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Gavel,
  GraduationCap,
  Landmark,
  MessageCircle,
  PencilLine,
  Phone,
  QrCode,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { FyugInterestForm } from '@/components/fyug-interest-form';
import './fyug-interest.css';

export const metadata: Metadata = {
  title: 'Fourth-Year UG Admission 2026 | Don Bosco College, Tura',
  description:
    'Fourth-Year Undergraduate Honours admission under NEP 2020 at Don Bosco College, Tura. Interest registration, important dates, entrance test, and eligibility for Semester VII admission.',
};

const importantDates = [
  {
    label: 'Form will be issued from',
    date: '30 July 2026',
    icon: FileText,
  },
  {
    label: 'Last date of issuing form',
    date: '6 August 2026',
    icon: CalendarDays,
  },
  {
    label: 'Last date of admission',
    date: '10 August 2026',
    icon: GraduationCap,
  },
] as const;

const eligibilityItems = [
  { label: '120 Credits completed', icon: ShieldCheck },
  { label: 'No Back Papers', icon: FileText },
  { label: 'Semester VI FYUP cleared', icon: GraduationCap },
  { label: 'NEHU-affiliated college student', icon: Landmark },
] as const;

const programmes = [
  { name: 'Garo', icon: Users },
  { name: 'English', icon: BookOpen },
  { name: 'Education', icon: GraduationCap },
  { name: 'Political Science', icon: Gavel },
  { name: 'Sociology', icon: Users },
  { name: 'Economics', icon: TrendingUp },
] as const;

const processSteps = [
  'Interest Registration',
  'Eligibility Verification',
  'Document Upload',
  'Confirmation & Acknowledgement',
] as const;

const FORM_DEADLINE = new Date('2026-08-06T23:59:59+05:30');

function daysUntilFormClose() {
  const ms = FORM_DEADLINE.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function FyugInterestPage() {
  const daysLeft = daysUntilFormClose();

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
              <p className="fyug-session-badge">Admission Open · NEP 2020</p>
              <h1>
                <span className="fyug-hero-title-main">Fourth-Year UG</span>
                <span className="fyug-hero-title-accent">Admission</span>
              </h1>
              <p className="fyug-hero-lead">
                Bonafide students of any NEHU-affiliated college (including Don Bosco College, Tura)
                who have successfully cleared the Semester VI FYUP (NEP 2020) examination.
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

      <section className="shell fyug-entrance" aria-label="Entrance test">
        <div className="fyug-entrance-card">
          <Clock3 aria-hidden />
          <div>
            <p className="fyug-entrance-kicker">Entrance test</p>
            <p className="fyug-entrance-title">
              <strong>7 &amp; 8 August 2026</strong> at <strong>10:00 am</strong>
            </p>
            <p className="fyug-entrance-venue">Venue: Don Bosco College, Tura</p>
          </div>
        </div>
      </section>

      <section className="shell fyug-dates" aria-label="Important dates">
        <div className="fyug-dates-card">
          <div className="fyug-dates-head">
            <CalendarDays aria-hidden />
            <h2>Important dates</h2>
          </div>
          <ul className="fyug-dates-list">
            {importantDates.map((item) => (
              <li key={item.label}>
                <item.icon aria-hidden />
                <div>
                  <p>{item.label}</p>
                  <strong>{item.date}</strong>
                </div>
              </li>
            ))}
          </ul>
          <p className="fyug-dates-note">
            <CheckCircle2 aria-hidden />
            You may take admission if you have cleared the 6th Semester Examination 2026.
          </p>
          <p className="fyug-dates-urgency">
            {daysLeft === 0
              ? 'Last day to collect the form is today.'
              : daysLeft === 1
                ? '1 day left to collect the form.'
                : `${daysLeft} days left to collect the form.`}
          </p>
        </div>
      </section>

      <section className="shell fyug-programmes" aria-label="Available programmes">
        <h2>Available programmes for admission</h2>
        <ul className="fyug-programme-grid">
          {programmes.map((programme) => (
            <li key={programme.name}>
              <programme.icon aria-hidden />
              <span>{programme.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell fyug-scan" aria-label="Online registration">
        <div className="fyug-scan-card">
          <div className="fyug-scan-icon" aria-hidden>
            <QrCode />
          </div>
          <div>
            <h2>Scan here for quick access</h2>
            <p>
              Fill the Interest Registration Form online. Share this page link or scan the QR code
              on the college notice to register from your phone.
            </p>
            <a className="fyug-scan-link" href="#fyug-form">
              Open registration form
              <ChevronRight aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <section className="shell fyug-eligibility">
        <div className="fyug-mkt-head">
          <h2>Eligibility</h2>
          <a href="#fyug-form">Register now</a>
        </div>
        <p className="fyug-eligibility-intro">
          Only students having <strong>120 credits</strong> and <strong>no back papers</strong> at
          the completion of Semester VI will be eligible for admission into Semester VII.
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
            <p className="fyug-help-kicker">For enquiries</p>
            <h2>Contact Admission Office</h2>
          </div>
          <div className="fyug-help-actions">
            <a href="tel:+919402152496">
              <Phone aria-hidden />
              +91 94021 52496
            </a>
            <a href="tel:+919678402086">
              <Phone aria-hidden />
              +91 96784 02086
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
