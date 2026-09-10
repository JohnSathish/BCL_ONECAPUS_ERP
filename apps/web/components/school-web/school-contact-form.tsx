'use client';

import { useState } from 'react';
import { publicClient } from '@/lib/http/public-client';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { apiErrorMessage } from '@/utils/api-error';

export function SchoolContactForm() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  return (
    <form
      className="sls-form sls-card"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await publicClient.post('/v1/school-web/public/enquiries', form, {
            headers: { ...getLoginRequestHeaders(), 'X-Login-Host': window.location.hostname },
          });
          setOk('Thank you. The office has received your message.');
          setError(null);
        } catch (err) {
          setOk(null);
          setError(apiErrorMessage(err));
        }
      }}
    >
      <input
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <input
        placeholder="Subject"
        value={form.subject}
        onChange={(e) => setForm({ ...form, subject: e.target.value })}
      />
      <textarea
        rows={5}
        placeholder="Message"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        required
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
      <button type="submit" className="sls-btn sls-btn-gold">
        Send
      </button>
    </form>
  );
}
