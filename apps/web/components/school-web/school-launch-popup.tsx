'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useSchoolWebHref } from '@/components/school-web/school-web-host';
import {
  LAUNCH_POPUP_STORAGE_KEY,
  launchCountdownParts,
  launchPopupShouldDisplay,
  type SchoolLaunchPopupConfig,
} from '@/lib/school-web/launch-popup';

function dismissed(frequency: SchoolLaunchPopupConfig['frequency']) {
  if (typeof window === 'undefined') return true;
  if (frequency === 'visit') return false;
  try {
    if (frequency === 'session') {
      return sessionStorage.getItem(LAUNCH_POPUP_STORAGE_KEY) === '1';
    }
    const raw = localStorage.getItem(LAUNCH_POPUP_STORAGE_KEY);
    if (!raw) return false;
    if (frequency === 'once') return raw === '1' || raw.startsWith('day:');
    if (frequency === 'day') {
      const today = new Date().toISOString().slice(0, 10);
      return raw === `day:${today}`;
    }
  } catch {
    return false;
  }
  return false;
}

function remember(frequency: SchoolLaunchPopupConfig['frequency']) {
  try {
    if (frequency === 'visit') return;
    if (frequency === 'session') {
      sessionStorage.setItem(LAUNCH_POPUP_STORAGE_KEY, '1');
      return;
    }
    if (frequency === 'day') {
      localStorage.setItem(
        LAUNCH_POPUP_STORAGE_KEY,
        `day:${new Date().toISOString().slice(0, 10)}`,
      );
      return;
    }
    localStorage.setItem(LAUNCH_POPUP_STORAGE_KEY, '1');
  } catch {
    /* private mode */
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function SchoolLaunchPopup({ config }: { config: SchoolLaunchPopupConfig }) {
  const hrefFor = useSchoolWebHref();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const countdown = launchCountdownParts(config.launchAt, now);

  useEffect(() => {
    if (!launchPopupShouldDisplay(config) || dismissed(config.frequency)) return;
    setOpen(true);
  }, [config]);

  useEffect(() => {
    if (!open || !config.launchAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open, config.launchAt]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && config.closeButton) {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, config.closeButton]);

  function close() {
    remember(config.frequency);
    setOpen(false);
  }

  if (!open) return null;

  const ctaHref = hrefFor(config.ctaHref || '/');
  const ctaClass =
    config.ctaStyle === 'navy'
      ? 'sls-launch-cta is-navy'
      : config.ctaStyle === 'outline'
        ? 'sls-launch-cta is-outline'
        : 'sls-launch-cta';

  return (
    <div className="sls-launch" role="presentation">
      <button
        type="button"
        className="sls-launch-backdrop"
        aria-label="Dismiss announcement and continue to the website"
        onClick={() => config.closeButton && close()}
      />
      <div
        ref={dialogRef}
        className={`sls-launch-dialog sls-launch-${config.animation}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {config.closeButton ? (
          <button
            ref={closeRef}
            type="button"
            className="sls-launch-close"
            aria-label="Close coming soon announcement"
            onClick={close}
          >
            ×
          </button>
        ) : null}
        <div className="sls-launch-media">
          <img src={config.imageUrl} alt={config.imageAlt} />
        </div>
        <div className="sls-launch-copy">
          <img className="sls-launch-crest" src={config.logoUrl} alt="" />
          <p className="sls-launch-kicker">{config.kicker}</p>
          <h2 id={titleId} className="sls-launch-title">
            {config.title}
          </h2>
          {config.subtitle ? <p className="sls-launch-sub">{config.subtitle}</p> : null}
          <p className="sls-launch-body">{config.description}</p>
          {countdown ? (
            <div className="sls-launch-count" aria-label="Time remaining until launch">
              <p>Launching in</p>
              <ol>
                <li>
                  <strong>{pad(countdown.days)}</strong>
                  <span>Days</span>
                </li>
                <li>
                  <strong>{pad(countdown.hours)}</strong>
                  <span>Hours</span>
                </li>
                <li>
                  <strong>{pad(countdown.minutes)}</strong>
                  <span>Minutes</span>
                </li>
                <li>
                  <strong>{pad(countdown.seconds)}</strong>
                  <span>Seconds</span>
                </li>
              </ol>
            </div>
          ) : (
            <p className="sls-launch-soon">{config.launchingLabel}</p>
          )}
          {config.ctaLabel ? (
            <a
              className={ctaClass}
              href={ctaHref}
              target={config.ctaNewTab ? '_blank' : undefined}
              rel={config.ctaNewTab ? 'noreferrer' : undefined}
              onClick={() => {
                remember(config.frequency);
                setOpen(false);
              }}
            >
              {config.ctaLabel}
              <span aria-hidden>→</span>
            </a>
          ) : null}
          <p className="sls-launch-school">{config.footerLine}</p>
          <p className="sls-launch-place">{config.locationLine}</p>
        </div>
      </div>
    </div>
  );
}
