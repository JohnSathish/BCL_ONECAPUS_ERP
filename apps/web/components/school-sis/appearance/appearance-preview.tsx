'use client';

import { appearanceCssVars } from '@/lib/school-sis/appearance-tokens';
import type { AppearanceConfig } from '@/lib/school-sis/appearance';

export function AppearanceLivePreview({
  config,
  mode,
  device,
}: {
  config: AppearanceConfig;
  mode: 'desktop' | 'tablet' | 'mobile' | 'login';
  device?: string;
}) {
  const vars = appearanceCssVars(config);
  if (mode === 'login') {
    return (
      <div
        className="overflow-hidden rounded-2xl border border-white/60 bg-slate-900 shadow-xl"
        style={{ minHeight: 320 }}
      >
        <div
          className="flex h-full min-h-[320px]"
          style={{
            background:
              config.login.background === 'solid'
                ? config.colors.primary
                : `linear-gradient(135deg, ${config.colors.primary}, ${config.colors.secondary})`,
          }}
        >
          {config.login.layout === 'split' ? <div className="hidden w-1/2 md:block" /> : null}
          <div className="flex flex-1 items-center justify-center p-6">
            <div
              className="w-full max-w-sm border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur"
              style={{
                borderRadius: config.login.cardRadius,
                width: Math.min(config.login.cardWidth, 360),
              }}
            >
              <p className="text-lg font-semibold" style={{ color: config.colors.primary }}>
                {config.login.welcome}
              </p>
              <p className="mt-1 text-xs text-slate-500">{config.login.subtitle}</p>
              <div className="mt-4 space-y-2">
                <div className="h-9 rounded-lg bg-slate-100" />
                <div className="h-9 rounded-lg bg-slate-100" />
                <div
                  className="h-9 rounded-lg text-center text-xs font-semibold leading-9 text-white"
                  style={{ background: config.colors.primary }}
                >
                  {config.login.buttonLabel}
                </div>
              </div>
              <p className="mt-3 text-[10px] text-slate-400">{config.login.forgotLabel}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const width = mode === 'mobile' ? 280 : mode === 'tablet' ? 420 : '100%';
  return (
    <div
      className="overflow-hidden border border-slate-200 bg-white shadow-xl"
      style={{
        ...vars,
        width,
        maxWidth: '100%',
        borderRadius: config.components.cardRadius,
        margin: '0 auto',
      }}
    >
      <div
        className="flex h-9 items-center gap-2 px-3 text-[10px] text-white"
        style={{ background: config.colors.primary }}
      >
        <span className="font-semibold">{config.identity.shortName}</span>
        <span className="opacity-70">ERP</span>
      </div>
      <div className="flex min-h-[240px]">
        {mode !== 'mobile' ? (
          <aside
            className="border-r border-slate-100 bg-white p-2 text-[10px]"
            style={{ width: Math.min(96, config.sidebar.width / 3) }}
          >
            <p className="font-semibold" style={{ color: config.colors.primary }}>
              Home
            </p>
            <p className="mt-1 text-slate-400">Students</p>
            <p className="text-slate-400">Fees</p>
          </aside>
        ) : null}
        <div className="flex-1 p-3" style={{ background: config.colors.background }}>
          <p className="text-sm font-semibold" style={{ color: config.colors.text }}>
            Dashboard
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {['248', '96%'].map((n) => (
              <div
                key={n}
                className="bg-white p-2 text-[10px] shadow-sm"
                style={{ borderRadius: config.components.cardRadius / 2 }}
              >
                <p className="text-slate-400">Metric</p>
                <p className="text-lg font-bold" style={{ color: config.colors.primary }}>
                  {n}
                </p>
              </div>
            ))}
          </div>
          {device === 'mobile' || mode === 'mobile' ? (
            <div className="mt-4 flex justify-around border-t border-slate-200 pt-2 text-[9px] text-slate-500">
              <span>Home</span>
              <span>Messages</span>
              <span>More</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
