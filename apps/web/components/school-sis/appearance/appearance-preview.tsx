'use client';

import { appearanceCssVars } from '@/lib/school-sis/appearance-tokens';
import type { AppearanceConfig } from '@/lib/school-sis/appearance';

export function AppearanceLivePreview({
  config,
  mode,
  device,
  themeId,
}: {
  config: AppearanceConfig;
  mode: 'desktop' | 'tablet' | 'mobile' | 'login';
  device?: string;
  themeId?: string;
}) {
  const vars = appearanceCssVars(config, { themeId, sidebarWidth: config.sidebar.width });
  if (mode === 'login') {
    return (
      <div
        className="overflow-hidden rounded-2xl border shadow-xl"
        style={{ ...vars, minHeight: 320, borderColor: 'var(--border-hex)' }}
      >
        <div
          className="flex h-full min-h-[320px]"
          style={{
            background:
              config.login.background === 'solid'
                ? 'var(--button-primary)'
                : `linear-gradient(135deg, var(--button-primary), var(--secondary-hex))`,
          }}
        >
          {config.login.layout === 'split' ? <div className="hidden w-1/2 md:block" /> : null}
          <div className="flex flex-1 items-center justify-center p-6">
            <div
              className="w-full max-w-sm border p-6 shadow-2xl"
              style={{
                borderRadius: config.login.cardRadius,
                width: Math.min(config.login.cardWidth, 360),
                background: 'var(--surface)',
                borderColor: 'var(--border-hex)',
                color: 'var(--text)',
              }}
            >
              <p className="text-lg font-semibold" style={{ color: 'var(--heading)' }}>
                {config.login.welcome}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground-hex)' }}>
                {config.login.subtitle}
              </p>
              <div className="mt-4 space-y-2">
                <div className="h-9 rounded-lg" style={{ background: 'var(--muted-hex)' }} />
                <div className="h-9 rounded-lg" style={{ background: 'var(--muted-hex)' }} />
                <div
                  className="h-9 rounded-lg text-center text-xs font-semibold leading-9"
                  style={{
                    background: 'var(--button-primary)',
                    color: 'var(--primary-foreground-hex)',
                  }}
                >
                  {config.login.buttonLabel}
                </div>
              </div>
              <p className="mt-3 text-[10px]" style={{ color: 'var(--muted-foreground-hex)' }}>
                {config.login.forgotLabel}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const width = mode === 'mobile' ? 280 : mode === 'tablet' ? 420 : '100%';
  return (
    <div
      className="school-erp-shell is-sls overflow-hidden border shadow-xl"
      style={{
        ...vars,
        width,
        maxWidth: '100%',
        borderRadius: config.components.cardRadius,
        margin: '0 auto',
        position: 'relative',
        height: 'auto',
        inset: 'auto',
        display: 'block',
        borderColor: 'var(--border-hex)',
      }}
    >
      <div
        className="flex h-9 items-center gap-2 px-3 text-[10px]"
        style={{
          background: 'var(--surface)',
          color: 'var(--heading)',
          borderBottom: '1px solid var(--border-hex)',
        }}
      >
        <span className="font-semibold">{config.identity.shortName}</span>
        <span style={{ color: 'var(--muted-foreground-hex)' }}>ERP</span>
      </div>
      <div className="flex min-h-[240px]">
        {mode !== 'mobile' ? (
          <aside
            className="school-erp-sidebar p-2 text-[10px]"
            style={{
              width: Math.min(110, config.sidebar.width / 2.2),
              height: 'auto',
              background: 'var(--sidebar-background)',
              color: 'var(--sidebar-foreground)',
            }}
          >
            <p className="school-erp-nav-group-label px-1">Home</p>
            <p
              className="school-erp-nav-link is-active mt-1"
              style={{
                background: 'var(--sidebar-active)',
                color: 'var(--sidebar-active-foreground)',
              }}
            >
              Dashboard
            </p>
            <p className="school-erp-nav-link mt-0.5">Students</p>
            <p className="school-erp-nav-link">Fees</p>
          </aside>
        ) : null}
        <div className="flex-1 p-3" style={{ background: 'var(--background-hex)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--heading)' }}>
            Dashboard
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {['248', '96%'].map((n) => (
              <div
                key={n}
                className="p-2 text-[10px] shadow-sm"
                style={{
                  borderRadius: config.components.cardRadius / 2,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              >
                <p style={{ color: 'var(--muted-foreground-hex)' }}>Metric</p>
                <p className="text-lg font-bold" style={{ color: 'var(--heading)' }}>
                  {n}
                </p>
              </div>
            ))}
          </div>
          {device === 'mobile' || mode === 'mobile' ? (
            <div
              className="mt-4 flex justify-around border-t pt-2 text-[9px]"
              style={{
                borderColor: 'var(--border-hex)',
                color: 'var(--muted-foreground-hex)',
              }}
            >
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
