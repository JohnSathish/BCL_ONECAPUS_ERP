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
    <section className="border-t border-white/10 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">
        Leadership
      </p>
      <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Message from the Principal</h2>

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
              className="h-48 w-48 rounded-full object-cover lg:h-56 lg:w-56"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-full bg-[#1e3a5f] text-3xl font-bold text-white lg:h-56 lg:w-56">
              {name
                .split(' ')
                .slice(-2)
                .map((w) => w[0])
                .join('')}
            </div>
          )}
          <p className="mt-4 text-center text-sm font-semibold text-white md:text-left">{name}</p>
          <p className="text-center text-xs text-slate-400 md:text-left">{title}</p>
        </div>

        <blockquote className="text-lg leading-relaxed text-slate-300 sm:text-xl">
          &ldquo;{message}&rdquo;
        </blockquote>
      </div>
    </section>
  );
}
