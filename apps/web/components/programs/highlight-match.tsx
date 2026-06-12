'use client';

import { Fragment } from 'react';

type Props = {
  text: string;
  query?: string;
  className?: string;
};

export function HighlightMatch({ text, query, className }: Props) {
  const term = query?.trim();
  if (!term || term.length < 2) {
    return <span className={className}>{text}</span>;
  }

  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(needle, cursor);
  let key = 0;

  while (index !== -1) {
    if (index > cursor) {
      parts.push(<Fragment key={key++}>{text.slice(cursor, index)}</Fragment>);
    }
    parts.push(
      <mark key={key++} className="rounded bg-primary/15 px-0.5 font-medium text-primary">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = lower.indexOf(needle, cursor);
  }

  if (cursor < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);
  }

  return <span className={className}>{parts}</span>;
}
