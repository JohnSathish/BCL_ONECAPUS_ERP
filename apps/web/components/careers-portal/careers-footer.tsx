'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchCareersPortalInfo } from '@/services/careers-portal';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';

export function CareersFooter() {
  const infoQ = useQuery({
    queryKey: ['careers-portal-info'],
    queryFn: fetchCareersPortalInfo,
  });
  const info = infoQ.data;
  const website = info?.websiteUrl ?? 'https://donboscocollege.ac.in';

  return (
    <footer className="mt-20 border-t border-white/10 bg-[#070f1a]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            {info?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.logoUrl}
                alt=""
                className="mb-4 h-14 w-14 rounded-xl bg-white/10 p-2"
              />
            ) : null}
            <p className="text-lg font-bold text-white">
              {info?.collegeName ?? 'Don Bosco College, Tura'}
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-slate-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              {info?.address ?? 'Tura, West Garo Hills, Meghalaya, India'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <Phone className="h-4 w-4 shrink-0 text-sky-400" />
              <a href={`tel:${info?.contactPhone}`} className="hover:text-white">
                {info?.contactPhone ?? '+91 3651 232 291'}
              </a>
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <Mail className="h-4 w-4 shrink-0 text-sky-400" />
              <a href={`mailto:${info?.contactEmail}`} className="hover:text-white">
                {info?.contactEmail ?? 'career@donboscocollege.ac.in'}
              </a>
            </p>
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-white"
            >
              Visit college website
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300/80">
              Recruitment
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li>
                <Link href="/careers-portal/jobs" className="transition hover:text-white">
                  Current Openings
                </Link>
              </li>
              <li>
                <Link href="/careers-portal/apply" className="transition hover:text-white">
                  Apply Online
                </Link>
              </li>
              <li>
                <Link
                  href="/careers-portal/application-status"
                  className="transition hover:text-white"
                >
                  Track Application
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300/80">
              Policies
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li>
                <a
                  href={`${website}/recruitment-policy`}
                  className="transition hover:text-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  Recruitment Policy
                </a>
              </li>
              <li>
                <a
                  href={`${website}/privacy`}
                  className="transition hover:text-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href={`${website}/terms`}
                  className="transition hover:text-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300/80">
              Institution
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>{info?.institutional?.naacGrade ?? 'NAAC B Grade'}</li>
              <li>{info?.institutional?.departments ?? 17} Academic Departments</li>
              <li>{info?.institutional?.yearsOfExcellence ?? 39}+ Years of Excellence</li>
              <li>Don Bosco Mission · Salesian Education</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {info?.collegeName ?? 'Don Bosco College, Tura'} · Official
        Recruitment Portal · All rights reserved
      </div>
    </footer>
  );
}
