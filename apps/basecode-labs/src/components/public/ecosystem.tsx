'use client';

import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';

const NODES = ['Website', 'ERP', 'Mobile App', 'GST', 'Cloud', 'Client'];

export function Ecosystem() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % NODES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <div className="pulse-ring absolute inset-[18%] rounded-full border border-cyan-400/30" />
      <div className="absolute inset-[8%] rounded-full border border-blue-400/25" />
      <div className="absolute inset-[22%] rounded-full border border-emerald-400/20" />
      <div className="floaty absolute inset-0 m-auto flex h-[168px] w-[168px] items-center justify-center">
        <BrandLogo size={168} className="ring-4 ring-cyan-300/40" />
      </div>
      {NODES.map((node, idx) => {
        const angle = (idx / NODES.length) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 46;
        const y = 50 + Math.sin(angle) * 46;
        const active = idx === i;
        return (
          <div
            key={node}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg ${
              active
                ? 'border-cyan-200 bg-cyan-300 text-slate-900'
                : 'border-white/20 bg-[#071428]/80 text-white backdrop-blur'
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {node}
          </div>
        );
      })}
    </div>
  );
}
