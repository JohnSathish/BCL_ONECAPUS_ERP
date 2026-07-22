'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { contactSchema } from '@/lib/forms';

type ContactValues = z.input<typeof contactSchema>;

export function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', subject: '', message: '', company: '' },
  });
  const [status, setStatus] = useState('');

  return (
    <form
      className="contact-form"
      onSubmit={handleSubmit(async (values) => {
        setStatus('Sending…');
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        });
        const result = (await response.json()) as { message?: string };
        setStatus(
          result.message ?? (response.ok ? 'Message accepted.' : 'Unable to send your message.'),
        );
        if (response.ok) reset();
      })}
    >
      <label>
        Name
        <input aria-invalid={Boolean(errors.name)} {...register('name')} />
      </label>
      <label>
        Email
        <input type="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
      </label>
      <label>
        Phone
        <input inputMode="tel" {...register('phone')} />
      </label>
      <label>
        Subject
        <input aria-invalid={Boolean(errors.subject)} {...register('subject')} />
      </label>
      <label className="full">
        Message
        <textarea rows={6} aria-invalid={Boolean(errors.message)} {...register('message')} />
      </label>
      <input
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        {...register('company')}
      />
      <Button type="submit" disabled={isSubmitting}>
        Send message
      </Button>
      <p aria-live="polite">{Object.values(errors)[0]?.message || status}</p>
    </form>
  );
}
