'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Search, X } from 'lucide-react';
import type { CareersPortalInfo } from '@/services/careers-portal';
import { cn } from '@/utils/cn';

function whatsappHref(phone?: string) {
  const digits = (phone ?? '+919863000000').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent('Hello, I have a query regarding recruitment at Don Bosco College Tura.')}`;
}

export function CareersFloatingWidgets({ info }: { info?: CareersPortalInfo }) {
  const router = useRouter();
  const [trackOpen, setTrackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [applicationNo, setApplicationNo] = useState('');
  const [mobile, setMobile] = useState('');

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (applicationNo.trim()) params.set('no', applicationNo.trim());
    if (mobile.trim()) params.set('mobile', mobile.trim());
    router.push(`/careers-portal/application-status?${params.toString()}`);
  };

  return (
    <>
      {/* Track application — bottom left */}
      <div className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)] sm:bottom-6 sm:left-6">
        {trackOpen ? (
          <div className="w-72 rounded-2xl border border-white/15 bg-[#0c1829]/95 p-4 shadow-2xl backdrop-blur-xl sm:w-80">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Track Application</p>
              <button
                type="button"
                onClick={() => setTrackOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleTrack} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Application No.</label>
                <input
                  value={applicationNo}
                  onChange={(e) => setApplicationNo(e.target.value)}
                  placeholder="DBC-APP-2026-xxxxx"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Mobile No.</label>
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white hover:bg-[#152a45]"
              >
                <Search className="h-4 w-4" />
                Track Status
              </button>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTrackOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-[#0c1829]/90 px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur-md transition hover:bg-[#1e3a5f]"
          >
            <Search className="h-4 w-4" />
            Track Application
          </button>
        )}
      </div>

      {/* WhatsApp help — bottom right */}
      <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        {helpOpen ? (
          <div className="mb-3 w-64 rounded-2xl border border-white/15 bg-[#0c1829]/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Need Help?</p>
            <p className="mt-1 text-xs text-slate-400">Chat with the Recruitment Office</p>
            <a
              href={whatsappHref(info?.whatsappSupport ?? info?.contactPhone)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2.5 text-sm font-semibold text-white hover:bg-[#1fb855]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Support
            </a>
            <p className="mt-2 text-center text-xs text-slate-500">
              {info?.contactEmail ?? 'career@donboscocollege.ac.in'}
            </p>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="mt-2 w-full text-xs text-slate-500 hover:text-slate-300"
            >
              Close
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-xl transition',
            helpOpen ? 'bg-[#1e3a5f]' : 'bg-[#25D366] hover:bg-[#1fb855]',
          )}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Need Help?</span>
        </button>
      </div>
    </>
  );
}
