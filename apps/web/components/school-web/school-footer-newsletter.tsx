'use client';

import { useState } from 'react';
import { publicClient } from '@/lib/http/public-client';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { apiErrorMessage } from '@/utils/api-error';

export function SchoolFooterNewsletter({ intro }: { intro: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="sls-footer-news"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        setOk(null);
        try {
          const local = email.split('@')[0]?.trim() || 'Subscriber';
          await publicClient.post(
            '/v1/school-web/public/enquiries',
            {
              name: local.length >= 2 ? local : 'Subscriber',
              email,
              subject: 'Newsletter',
              message: 'Please send school news and event updates to this email address.',
            },
            { headers: { ...getLoginRequestHeaders(), 'X-Login-Host': window.location.hostname } },
          );
          setOk('Thank you. The office has received your request.');
          setEmail('');
        } catch (err) {
          setError(apiErrorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {intro ? <p>{intro}</p> : null}
      <label className="sr-only" htmlFor="sls-footer-email">
        Email address
      </label>
      <input
        id="sls-footer-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
      />
      <button type="submit" className="sls-btn sls-btn-gold" disabled={pending}>
        {pending ? 'Sending…' : 'Subscribe'}
      </button>
      {error ? <p className="sls-footer-news-err">{error}</p> : null}
      {ok ? <p className="sls-footer-news-ok">{ok}</p> : null}
    </form>
  );
}
