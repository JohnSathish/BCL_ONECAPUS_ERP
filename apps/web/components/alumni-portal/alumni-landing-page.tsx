'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';
import { fetchAlumniPortalInfo } from '@/services/alumni-portal';

export function AlumniLandingPage() {
  const infoQ = useQuery({
    queryKey: ['alumni-portal-info'],
    queryFn: fetchAlumniPortalInfo,
  });
  const info = infoQ.data;
  const settings = info?.settings;
  const stats = info?.stats;
  const heroImages = useMemo(
    () =>
      settings?.heroImages?.length
        ? settings.heroImages
        : settings?.heroImageUrl
          ? [settings.heroImageUrl]
          : [],
    [settings?.heroImageUrl, settings?.heroImages],
  );
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setActiveSlide(0);
  }, [heroImages.length]);

  useEffect(() => {
    if (heroImages.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroImages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroImages]);

  return (
    <AlumniPublicShell associationName={settings?.associationName} logoUrl={settings?.logoUrl}>
      <section className="relative overflow-hidden">
        {heroImages.length ? (
          heroImages.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
              style={{
                backgroundImage: `url(${image})`,
                opacity: index === activeSlide ? 1 : 0,
              }}
            />
          ))
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(135deg, #1a2b47 0%, #243b5c 45%, #1a2b47 100%)',
            }}
          />
        )}
        <div className="absolute inset-0 bg-[#1a2b47]/72" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:px-6 lg:py-28">
          <div className="text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f3b63b]">
              Welcome to —
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
              Don Bosco College Tura
            </h1>
            <p
              className="mt-2 text-4xl text-[#f3b63b] md:text-5xl"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
            >
              Alumni Association
            </p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
              A community of former students who carry forward the legacy of Don Bosco with pride,
              gratitude and service to society.
            </p>
            <Link
              href="/alumni-portal/register"
              className="mt-8 inline-flex items-center rounded-md bg-[#f3b63b] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#1a2b47] transition hover:bg-[#e5a82e]"
            >
              Become a Member →
            </Link>
            {heroImages.length > 1 ? (
              <div className="mt-8 flex items-center gap-2">
                {heroImages.map((image, index) => (
                  <button
                    key={`${image}-dot-${index}`}
                    type="button"
                    aria-label={`Show slide ${index + 1}`}
                    className={`h-2.5 w-8 rounded-full transition ${
                      index === activeSlide ? 'bg-[#f3b63b]' : 'bg-white/40'
                    }`}
                    onClick={() => setActiveSlide(index)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 lg:px-6">
        <div className="grid gap-4 rounded-2xl bg-[#1a2b47] px-4 py-6 text-white shadow-xl sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
          <Stat
            label="Alumni Worldwide"
            value={`${(stats?.displayAlumni ?? 5000).toLocaleString()}+`}
          />
          <Stat label="Years of Legacy" value={`${stats?.legacyYears ?? 80}+`} />
          <Stat label="Events Organized" value={`${stats?.eventsOrganized ?? 50}+`} />
          <Stat label="Countries Connected" value={`${stats?.countries ?? 20}+`} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <h2 className="font-serif text-3xl text-[#1a2b47] md:text-4xl">
              United by Education.
              <br />
              Inspired by Don Bosco.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#1a2b47]/80">
              {settings?.tagline ||
                'The Alumni Association is a bridge between past and present students — nurturing fellowship, mentorship, and service to the college and society.'}
            </p>
            <Link
              href="/alumni-portal/about"
              className="mt-6 inline-flex rounded-md bg-[#1a2b47] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white"
            >
              Learn More About Us →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              title="Stay Connected"
              body="Reconnect with old friends and expand your network."
            />
            <FeatureCard
              title="Give Back"
              body="Support current students and campus initiatives."
            />
            <FeatureCard
              title="Make an Impact"
              body="Be a part of projects that create a lasting difference."
            />
          </div>
        </div>
      </section>

      {info?.membershipTypes?.length ? (
        <section className="border-t border-[#1a2b47]/10 bg-white py-14">
          <div className="mx-auto max-w-6xl px-4 lg:px-6">
            <h3 className="font-serif text-2xl text-[#1a2b47]">Membership</h3>
            <p className="mt-2 text-sm text-[#1a2b47]/70">
              Choose a membership that fits your journey with the college.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {info.membershipTypes.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-[#1a2b47]/12 bg-[#f7f5f0] p-5 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-[#f3b63b]">
                    {t.code}
                  </p>
                  <h4 className="mt-1 font-serif text-xl text-[#1a2b47]">{t.name}</h4>
                  <p className="mt-2 text-sm text-[#1a2b47]/75">{t.description}</p>
                  <p className="mt-4 text-2xl font-semibold text-[#1a2b47]">
                    ₹{t.amountInr.toLocaleString('en-IN')}
                  </p>
                  <Link
                    href={`/alumni-portal/register?type=${t.id}`}
                    className="mt-4 inline-block text-xs font-bold uppercase tracking-wide text-[#1a2b47] underline"
                  >
                    Join now
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </AlumniPublicShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center lg:text-left">
      <p className="text-2xl font-semibold text-[#f3b63b]">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
        {label}
      </p>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#1a2b47]/10 bg-white p-5 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#1a2b47] text-sm font-bold text-[#f3b63b]">
        ★
      </div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-[#1a2b47]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#1a2b47]/75">{body}</p>
    </div>
  );
}
