'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, List, Mail, Phone, Send, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { contactSchema } from '@/lib/forms';

type ContactValues = z.input<typeof contactSchema>;

const SUBJECTS = [
  'General enquiry',
  'Admissions',
  'Campus visit',
  'Academics / programmes',
  'Examination',
  'Feedback',
  'Other',
] as const;

export function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      company: '',
    },
  });
  const [status, setStatus] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  return (
    <form
      className="contact-form-panel"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setOk(null);
        setStatus('Sending…');
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        });
        const result = (await response.json()) as { message?: string };
        const message =
          result.message ?? (response.ok ? 'Message accepted.' : 'Unable to send your message.');
        setStatus(message);
        setOk(response.ok);
        if (response.ok) reset();
      })}
    >
      <header className="contact-form-head">
        <span className="contact-form-icon" aria-hidden>
          <Mail />
        </span>
        <div>
          <h2>We would love to hear from you.</h2>
          <p>Share your question and our office will respond shortly.</p>
        </div>
      </header>

      <div className="contact-form-grid">
        <label className="contact-field">
          <span>Full Name</span>
          <span className="contact-field-control">
            <UserRound aria-hidden />
            <input
              placeholder="Enter your full name"
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </span>
          {errors.name ? <em>{errors.name.message}</em> : null}
        </label>

        <label className="contact-field">
          <span>Email Address</span>
          <span className="contact-field-control">
            <Mail aria-hidden />
            <input
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </span>
          {errors.email ? <em>{errors.email.message}</em> : null}
        </label>

        <label className="contact-field">
          <span>Phone Number</span>
          <span className="contact-field-control">
            <Phone aria-hidden />
            <input
              inputMode="tel"
              placeholder="Enter your phone number"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </span>
          {errors.phone ? <em>{errors.phone.message}</em> : null}
        </label>

        <label className="contact-field">
          <span>Subject</span>
          <span className="contact-field-control contact-field-select">
            <List aria-hidden />
            <select aria-invalid={Boolean(errors.subject)} defaultValue="" {...register('subject')}>
              <option value="" disabled>
                Select a subject
              </option>
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="contact-select-chevron" />
          </span>
          {errors.subject ? <em>{errors.subject.message}</em> : null}
        </label>

        <label className="contact-field contact-field-full">
          <span>Message</span>
          <textarea
            rows={6}
            placeholder="Write your message here…"
            aria-invalid={Boolean(errors.message)}
            {...register('message')}
          />
          {errors.message ? <em>{errors.message.message}</em> : null}
        </label>
      </div>

      <input
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        {...register('company')}
      />

      <div className="contact-form-actions">
        <Button type="submit" disabled={isSubmitting} className="contact-submit">
          Send Message <Send aria-hidden />
        </Button>
        <p className="contact-privacy">
          <ShieldCheck aria-hidden />
          Your information is safe with us. We respect your privacy.
        </p>
      </div>

      <p
        className={`contact-form-status${ok === false ? ' is-error' : ''}${ok ? ' is-ok' : ''}`}
        aria-live="polite"
      >
        {status}
      </p>
    </form>
  );
}
