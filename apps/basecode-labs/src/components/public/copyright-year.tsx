'use client';

/** Renders the visitor’s current calendar year so copyright stays current without a deploy. */
export function CopyrightYear() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
