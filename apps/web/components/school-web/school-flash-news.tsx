'use client';

import { useMemo, useState } from 'react';
import { useSchoolWebHref } from '@/components/school-web/school-web-host';
import {
  parseFlashNewsPayload,
  visibleFlashNews,
  type SchoolFlashIcon,
  type SchoolFlashNewsItem,
} from '@/lib/school-web/flash-news';

function FlashIcon({ name }: { name: SchoolFlashIcon }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    'aria-hidden': true as const,
  };
  if (name === 'admissions') {
    return (
      <svg {...common}>
        <path
          d="M12 3 3.5 8v2h17V8L12 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M6 12v4.5c2.2 1.6 9.8 1.6 12 0V12" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 12v8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === 'exam') {
    return (
      <svg {...common}>
        <path
          d="M7 4.5h7.5L19 9v10.5H7V4.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M14.5 4.5V9H19M9.5 13h5M9.5 16.5h3.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M4.5 18c.4-3 2.6-4.6 4.5-4.6S13.1 15 13.5 18M13.8 13.6c1.5-.2 3.2.8 3.7 3.4"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (name === 'megaphone') {
    return (
      <svg {...common}>
        <path
          d="M4 10.5v3l3 .8 8.5 3.2V6.5L7 9.7 4 10.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M7 14.2V18" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M7 4.5h10v15H7V4.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function FlashItem({
  item,
  hrefFor,
  inert,
}: {
  item: SchoolFlashNewsItem;
  hrefFor: (href: string) => string;
  inert?: boolean;
}) {
  const body = (
    <>
      <span className="sls-flash-icon">
        <FlashIcon name={item.icon} />
      </span>
      <span className="sls-flash-title">{item.title}</span>
      {item.isNew ? <span className="sls-flash-new">NEW</span> : null}
    </>
  );
  if (!item.href || inert) {
    return (
      <span className="sls-flash-item" aria-hidden={inert || undefined}>
        {body}
      </span>
    );
  }
  const href = hrefFor(item.href);
  const external = /^https?:/i.test(href);
  return (
    <a
      className="sls-flash-item"
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {body}
    </a>
  );
}

export function SchoolFlashNews({ payload }: { payload: Record<string, unknown> }) {
  const hrefFor = useSchoolWebHref();
  const parsed = parseFlashNewsPayload(payload);
  const items = visibleFlashNews(parsed.items);
  const [paused, setPaused] = useState(false);
  const [offset, setOffset] = useState(0);
  const ordered = useMemo(() => {
    if (!items.length) return items;
    const n = ((offset % items.length) + items.length) % items.length;
    return [...items.slice(n), ...items.slice(0, n)];
  }, [items, offset]);
  const copies = ordered.length ? [...ordered, ...ordered, ...ordered] : [];
  const duration = Math.max(18, ordered.length * 7);

  if (!ordered.length) return null;

  return (
    <aside className={`sls-flash${paused ? ' is-paused' : ''}`} aria-label={parsed.label}>
      <div className="sls-flash-label">
        <span className="sls-flash-megaphone" aria-hidden>
          <FlashIcon name="megaphone" />
          <em>✦</em>
        </span>
        <strong>{parsed.label}</strong>
      </div>
      <div className="sls-flash-viewport">
        <div className="sls-flash-track" style={{ animationDuration: `${duration}s` }}>
          {copies.map((item, index) => (
            <span key={`${item.id}-${index}`} className="sls-flash-slot">
              <FlashItem item={item} hrefFor={hrefFor} inert={index >= ordered.length} />
            </span>
          ))}
        </div>
      </div>
      <div className="sls-flash-controls">
        <button
          type="button"
          className="sls-flash-btn"
          aria-label={paused ? 'Play flash news' : 'Pause flash news'}
          onClick={() => setPaused((v) => !v)}
        >
          {paused ? (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path d="M8 6h3v12H8V6Zm5 0h3v12h-3V6Z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="sls-flash-btn"
          aria-label="Previous flash news item"
          onClick={() => {
            setPaused(true);
            setOffset((n) => n - 1);
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path
              d="M15.5 5.5 8 12l7.5 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="sls-flash-btn"
          aria-label="Next flash news item"
          onClick={() => {
            setPaused(true);
            setOffset((n) => n + 1);
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path
              d="M8.5 5.5 16 12l-7.5 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}
