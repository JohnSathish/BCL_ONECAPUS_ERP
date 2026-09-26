'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  isExternalWebsiteHref,
  type WebsiteQuickLink,
  type WebsiteQuickLinkKey,
} from '@/lib/website-quick-links';

function LandmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false" fill="none">
      <path
        d="M4 20h16M6 20V10l6-4 6 4v10M9 20v-4h6v4M10 10h.01M14 10h.01M12 13h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      fill="currentColor"
    >
      <path d="M17.6 9.48 19.2 6.7a.5.5 0 0 0-.86-.5l-1.66 2.88A8.9 8.9 0 0 0 12 8c-1.7 0-3.26.48-4.68 1.28L5.66 6.2a.5.5 0 1 0-.86.5l1.6 2.78A8.5 8.5 0 0 0 3.5 16.5h17a8.5 8.5 0 0 0-2.9-7.02ZM8.25 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7.5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      fill="currentColor"
    >
      <path d="M16.7 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.8-2.8-.7-1.4.1-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1-.1 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.8ZM14.8 6.5c.6-.7 1-1.7.9-2.7-0.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.6-1 2.6 1 .1 1.9-.5 2.6-1.2Z" />
    </svg>
  );
}

export function QuickLinkIcon({
  linkKey,
  className,
}: {
  linkKey: WebsiteQuickLinkKey;
  className?: string;
}) {
  if (linkKey === 'erpLogin') return <LandmarkIcon className={className} />;
  if (linkKey === 'androidApp') return <AndroidIcon className={className} />;
  if (linkKey === 'iosApp') return <AppleIcon className={className} />;
  return null;
}

export function QuickLinkAnchor({
  link,
  className,
  children,
  onClick,
  ariaLabel,
}: {
  link: WebsiteQuickLink;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const external = isExternalWebsiteHref(link.href);
  const openNew = link.openInNewTab || external;
  if (external || openNew) {
    return (
      <a
        className={className}
        href={link.href}
        target={openNew ? '_blank' : undefined}
        rel={openNew ? 'noopener noreferrer' : undefined}
        onClick={onClick}
        aria-label={ariaLabel ?? link.label}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      className={className}
      href={link.href}
      onClick={onClick}
      aria-label={ariaLabel ?? link.label}
    >
      {children}
    </Link>
  );
}
