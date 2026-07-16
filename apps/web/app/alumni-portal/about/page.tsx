'use client';

import Link from 'next/link';
import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';

export default function AlumniAboutPage() {
  return (
    <AlumniPublicShell>
      <section className="border-b border-[#1a2b47]/10 bg-[#1a2b47]">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f3b63b]">
            Our story
          </p>
          <h1 className="mt-2 font-serif text-4xl text-white">About the Association</h1>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-14 lg:px-6">
        <p className="text-base leading-relaxed text-[#1a2b47]/85">
          The Alumni Association of Don Bosco College, Tura brings together generations of
          Bosconians who share a common formation in faith, reason, and service. We exist to keep
          friendships alive, mentor current students, and support the mission of the college across
          Meghalaya and the world.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ['Fellowship', 'Reconnect across batches and departments.'],
            ['Mentorship', 'Guide students with experience and care.'],
            ['Service', 'Give back to campus and society.'],
          ].map(([t, b]) => (
            <div key={t} className="rounded-xl border border-[#1a2b47]/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#f3b63b]">{t}</h2>
              <p className="mt-2 text-sm text-[#1a2b47]/75">{b}</p>
            </div>
          ))}
        </div>
        <Link
          href="/alumni-portal/register"
          className="mt-10 inline-flex rounded-md bg-[#f3b63b] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#1a2b47]"
        >
          Join the Association
        </Link>
      </div>
    </AlumniPublicShell>
  );
}
