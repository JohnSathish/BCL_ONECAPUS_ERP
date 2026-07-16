'use client';

import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';

export default function AlumniGalleryPage() {
  return (
    <AlumniPublicShell>
      <section className="border-b border-[#1a2b47]/10 bg-[#1a2b47]">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f3b63b]">
            Memories
          </p>
          <h1 className="mt-2 font-serif text-4xl text-white">Gallery</h1>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-14 lg:px-6">
        <div className="rounded-2xl border border-dashed border-[#1a2b47]/20 bg-white px-6 py-14 text-center shadow-sm">
          <h2 className="font-serif text-2xl text-[#1a2b47]">Coming soon</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#1a2b47]/70">
            Reunion albums and campus moments will appear here as the Alumni Office publishes event
            galleries.
          </p>
        </div>
      </div>
    </AlumniPublicShell>
  );
}
