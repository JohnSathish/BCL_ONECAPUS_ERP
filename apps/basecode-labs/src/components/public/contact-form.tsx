'use client';

import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  IndianRupee,
  Lock,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Send,
  UserRound,
} from 'lucide-react';

const SERVICES = ['Website', 'ERP', 'GST billing', 'Mobile app', 'Hosting', 'Other'];
const BUDGETS = [
  'Prefer to discuss',
  'Under ₹1 lakh',
  '₹1–5 lakh',
  '₹5–15 lakh',
  '₹15 lakh and above',
];
const CONTACTS = ['Email', 'Phone', 'WhatsApp'];
const MAX_FILE_MB = 10;
const ALLOWED = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [pending, setPending] = useState(false);
  const [filesLabel, setFilesLabel] = useState('Choose files');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setStatus('idle');
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const fileInput = formEl.querySelector<HTMLInputElement>('input[name="attachments"]');
    const names = fileInput?.files?.length
      ? Array.from(fileInput.files)
          .filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)
          .map((f) => f.name)
      : [];
    const body = {
      name: String(form.get('name') ?? ''),
      organisation: String(form.get('organisation') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      service: String(form.get('service') ?? ''),
      budget: String(form.get('budget') ?? ''),
      preferredContact: String(form.get('preferredContact') ?? ''),
      message: String(form.get('message') ?? ''),
      consent: form.get('consent') === 'on',
      acceptTerms: form.get('acceptTerms') === 'on',
      acceptPrivacy: form.get('acceptPrivacy') === 'on',
      attachmentNames: names,
    };
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setPending(false);
    setStatus(res.ok ? 'ok' : 'err');
    if (res.ok) {
      formEl.reset();
      setFilesLabel('Choose files');
    }
  }

  return (
    <form id="enquiry" onSubmit={onSubmit} className="bcl-card space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Send us an enquiry</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fill in the details below and our team will get back to you soon.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Name *
          <span className="relative mt-1 block">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              required
              name="name"
              placeholder="Your full name"
              className="bcl-input !mt-0 !pl-10"
            />
          </span>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Organisation
          <span className="relative mt-1 block">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="organisation"
              placeholder="School / College / Organisation"
              className="bcl-input !mt-0 !pl-10"
            />
          </span>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email *
          <span className="relative mt-1 block">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              required
              type="email"
              name="email"
              placeholder="you@domain.com"
              className="bcl-input !mt-0 !pl-10"
            />
          </span>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Phone *
          <span className="relative mt-1 block">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input required name="phone" placeholder="+91" className="bcl-input !mt-0 !pl-10" />
          </span>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Service
          <span className="relative mt-1 block">
            <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select name="service" className="bcl-input !mt-0 !pl-10">
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </span>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Budget
          <span className="relative mt-1 block">
            <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select name="budget" className="bcl-input !mt-0 !pl-10">
              <option value="">Select budget range</option>
              {BUDGETS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Preferred contact
        <span className="relative mt-1 block">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select name="preferredContact" className="bcl-input !mt-0 !pl-10">
            {CONTACTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </span>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Message *
        <span className="relative mt-1 block">
          <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <textarea
            required
            name="message"
            rows={5}
            placeholder="Tell us about your requirements, goals or any specific features…"
            className="bcl-input min-h-[140px] !mt-0 !pl-10"
          />
        </span>
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-blue-600" />
          <span>
            <span className="font-medium text-slate-800">Attach files (optional)</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              PDF, DOC, JPG, PNG (Max {MAX_FILE_MB} MB). File names are stored with your enquiry.
            </span>
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
          {filesLabel}
        </span>
        <input
          type="file"
          name="attachments"
          multiple
          accept={ALLOWED.join(',')}
          className="sr-only"
          onChange={(e) => {
            const n = e.target.files?.length ?? 0;
            setFilesLabel(n ? `${n} file${n > 1 ? 's' : ''} selected` : 'Choose files');
          }}
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input
          required
          type="checkbox"
          name="acceptTerms"
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          I have read and agree to the{' '}
          <a className="font-semibold text-blue-700" href="/legal/terms">
            Terms &amp; Conditions
          </a>
          . <span className="text-red-500">*</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input
          required
          type="checkbox"
          name="acceptPrivacy"
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          I acknowledge the{' '}
          <a className="font-semibold text-blue-700" href="/legal/privacy-policy">
            Privacy Policy
          </a>
          . <span className="text-red-500">*</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input
          required
          type="checkbox"
          name="consent"
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          I agree that BaseCode Labs can contact me regarding my enquiry.{' '}
          <span className="text-red-500">*</span>
        </span>
      </label>
      {status === 'ok' ? (
        <p className="text-sm text-emerald-700">Thank you. We will get back to you soon.</p>
      ) : null}
      {status === 'err' ? (
        <p className="text-sm text-red-600">
          Something went wrong. Email us at contact@basecodelabs.com.
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button disabled={pending} className="bcl-btn bcl-btn-accent gap-2">
          <Send className="h-4 w-4" />
          {pending ? 'Sending…' : 'Send enquiry'}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" />
          Your information is secure and will only be used to respond to your enquiry.
        </p>
      </div>
    </form>
  );
}
