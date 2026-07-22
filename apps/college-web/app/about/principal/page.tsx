import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen, GraduationCap, Mail, Quote, ShieldCheck } from 'lucide-react';
import { getCollegeContent } from '@/lib/content';
import {
  PRINCIPAL_FULL_MESSAGE,
  PRINCIPAL_PORTRAIT_ALT,
  PRINCIPAL_PORTRAIT_SRC,
} from '@/lib/principal-message';

export const metadata: Metadata = {
  title: "Principal's Desk",
  description: 'Message from Dr. Fr. Jogesh B. Sangma, Principal of Don Bosco College, Tura.',
};

export default async function PrincipalPage() {
  const content = await getCollegeContent();
  const message = content.principalIntroduction || PRINCIPAL_FULL_MESSAGE;
  const paragraphs = message
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const greeting = paragraphs[0] ?? 'Dear Staff and Students,';
  const body = paragraphs.slice(1);
  const quoteIndex = body.findIndex(
    (paragraph) => paragraph.startsWith('“Study') || paragraph.includes('William Arthur Ward'),
  );
  const quote = quoteIndex >= 0 ? body[quoteIndex] : null;
  const prose = quoteIndex >= 0 ? body.filter((_, index) => index !== quoteIndex) : body;

  return (
    <main id="main" className="principal-desk-page">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/about/history">About Us</Link>
            <span>/</span>
            <span>Principal&apos;s Desk</span>
          </div>
          <span className="eyebrow gold">Leadership</span>
          <h1>Principal&apos;s Desk</h1>
          <p>A message from Dr. Fr. Jogesh B. Sangma on excellence, formation and opportunity.</p>
        </div>
      </header>

      <section className="principal-desk-section">
        <div className="shell principal-desk-grid">
          <article className="principal-desk-card">
            <div className="principal-desk-identity">
              <div className="principal-desk-photo">
                <Image
                  src={PRINCIPAL_PORTRAIT_SRC}
                  alt={PRINCIPAL_PORTRAIT_ALT}
                  width={320}
                  height={400}
                  priority
                />
              </div>
              <div className="principal-desk-meta">
                <span className="principal-desk-chip">Principal</span>
                <strong>Dr. Fr. Jogesh B. Sangma</strong>
                <em>Don Bosco College, Tura</em>
                <p>
                  Guiding the college community in the pursuit of excellence, character formation
                  and socially responsible learning.
                </p>
                <ul className="principal-desk-highlights">
                  <li>
                    <GraduationCap aria-hidden /> Academic excellence
                  </li>
                  <li>
                    <ShieldCheck aria-hidden /> Character formation
                  </li>
                  <li>
                    <BookOpen aria-hidden /> Holistic education
                  </li>
                </ul>
                <a className="principal-desk-mail" href="mailto:principal@donboscocollege.ac.in">
                  <Mail aria-hidden /> principal@donboscocollege.ac.in
                </a>
              </div>
            </div>

            <div className="principal-desk-body">
              <h2>{greeting}</h2>
              {prose.map((paragraph) => (
                <p key={paragraph.slice(0, 72)}>
                  {paragraph.split('\n').map((line, index, lines) => (
                    <span key={`${line}-${index}`}>
                      {line}
                      {index < lines.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </p>
              ))}

              {quote ? (
                <blockquote className="principal-desk-quote">
                  <Quote aria-hidden />
                  <div>
                    {quote.split('\n').map((line, index, lines) => (
                      <span key={`${line}-${index}`}>
                        {line}
                        {index < lines.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </div>
                </blockquote>
              ) : null}

              <p className="principal-desk-sign">
                <strong>Dr. Fr. Jogesh B. Sangma</strong>
                <small>Principal, Don Bosco College, Tura</small>
              </p>
            </div>
          </article>

          <aside className="principal-desk-aside">
            <div className="principal-desk-side-card">
              <h2>Quick links</h2>
              <div className="principal-desk-links">
                <Link href="/admission/apply">
                  Apply for admission <ArrowRight aria-hidden />
                </Link>
                <Link href="/academics/programmes">
                  Explore programmes <ArrowRight aria-hidden />
                </Link>
                <Link href="/about/administration">
                  Administration <ArrowRight aria-hidden />
                </Link>
                <Link href="/news">
                  News &amp; notices <ArrowRight aria-hidden />
                </Link>
                <Link href="/contact">
                  Contact the college <ArrowRight aria-hidden />
                </Link>
              </div>
            </div>

            <div className="principal-desk-side-card is-accent">
              <h2>Our motto</h2>
              <p>
                <strong>“In Pursuit of Excellence”</strong>
              </p>
              <p>
                Preparing competent and socially committed young people to take their rightful place
                in society.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
