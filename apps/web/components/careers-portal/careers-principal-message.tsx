'use client';

import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { CareersPortalInfo } from '@/services/careers-portal';

export function CareersPrincipalMessage({ info }: { info?: CareersPortalInfo }) {
  const msg = info?.principalMessage;
  const name = msg?.name ?? 'Rev. Fr. Principal';
  const title = msg?.title ?? 'Principal, Don Bosco College Tura';
  const message =
    msg?.message ??
    'We welcome passionate educators committed to academic excellence, research, and the holistic development of our students. Join us in shaping the future of Northeast India.';

  return (
    <section className="py-16 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1d4ed8]">Leadership</p>
      <h2 className="mt-3 text-3xl font-bold text-[#0b1f4a] sm:text-4xl">
        Message from the Principal
      </h2>

      <div className="mt-10 grid items-start gap-10 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr] lg:gap-14">
        <div className="mx-auto md:mx-0">
          {msg?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                msg.photoUrl.startsWith('http')
                  ? msg.photoUrl
                  : (resolveUploadAssetUrl(msg.photoUrl) ?? msg.photoUrl)
              }
              alt={name}
              className="h-48 w-48 rounded-full object-cover ring-4 ring-[#f0b429]/30 lg:h-56 lg:w-56"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-full bg-[#0b1f4a] text-3xl font-bold text-white lg:h-56 lg:w-56">
              {name
                .split(' ')
                .slice(-2)
                .map((w) => w[0])
                .join('')}
            </div>
          )}
          <p className="mt-4 text-center text-sm font-semibold text-[#0b1f4a] md:text-left">
            {name}
          </p>
          <p className="text-center text-xs text-slate-500 md:text-left">{title}</p>
        </div>

        <blockquote className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6 text-lg leading-relaxed text-slate-700 sm:p-8 sm:text-xl">
          &ldquo;{message}&rdquo;
        </blockquote>
      </div>
    </section>
  );
}
