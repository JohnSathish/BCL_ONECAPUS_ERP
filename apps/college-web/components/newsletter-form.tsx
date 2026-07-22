'use client';

import { useId, useState } from 'react';

export function NewsletterForm() {
  const id = useId();
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      className="subscribe compact-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        setPending(true);
        setStatus('Sending…');
        try {
          const response = await fetch('/api/newsletter', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(values),
          });
          const result = (await response.json()) as { message?: string };
          setStatus(
            result.message ?? (response.ok ? 'Subscription accepted.' : 'Unable to subscribe.'),
          );
          if (response.ok) form.reset();
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <input
        id={id}
        name="email"
        type="email"
        required
        maxLength={254}
        placeholder="Your email address"
      />
      <input
        className="honeypot"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button type="submit" disabled={pending}>
        Subscribe
      </button>
      <span aria-live="polite">{status}</span>
    </form>
  );
}
