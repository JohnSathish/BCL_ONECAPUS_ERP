'use client';

import { Funnel, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Props = {
  activeCount: number;
  children: React.ReactNode;
};

/** Desktop: static sidebar. Mobile (≤960px): off-canvas drawer opened by a toggle button. */
export function QuestionBankFilterDrawer({ activeCount, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('select, input, button, a[href]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="qb-drawer-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <Funnel aria-hidden />
        <span>Filter Question Papers</span>
        {activeCount ? (
          <span className="qb-drawer-count" aria-label={`${activeCount} active filters`}>
            {activeCount}
          </span>
        ) : null}
      </button>

      <div className="qb-drawer-backdrop" data-open={open} aria-hidden onClick={close} />

      <div
        ref={panelRef}
        id={panelId}
        className="qb-sidebar"
        data-open={open}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Filter question papers' : undefined}
        onSubmit={() => setOpen(false)}
      >
        <button type="button" className="qb-drawer-close" onClick={close}>
          <X aria-hidden />
          <span className="sr-only">Close filters</span>
        </button>
        {children}
      </div>
    </>
  );
}
