import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { COMPANY } from '@/lib/company';
import { ContactForm } from '@/components/public/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact BaseCode Labs in Tamil Nadu and Meghalaya. We typically respond within 24 hours.',
};

export default function ContactPage() {
  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:px-6 lg:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
              Contact
              <span className="h-px w-10 bg-blue-500" />
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              Let’s start a <span className="text-blue-600">project</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
              Tell us about your school, college or organisation. We typically respond within 24
              hours. Enquiries become CRM leads in BaseCode Central.
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-4">
              {[
                { icon: Zap, title: 'Quick Response', copy: 'Within 24 hours' },
                { icon: Users, title: 'Direct Communication', copy: 'Talk to our team' },
                {
                  icon: ShieldCheck,
                  title: 'Your Information is Safe',
                  copy: 'We respect your privacy',
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                    <span className="text-xs text-slate-500">{item.copy}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="relative hidden min-h-[220px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0a3d82] via-[#0b4d9c] to-[#062044] p-8 text-white lg:block">
            <div className="grid-glow pointer-events-none absolute inset-0 opacity-50" />
            <p className="relative font-serif text-2xl italic leading-tight text-white/80">
              Ideas
              <br />
              Technology
              <br />
              Real Impact
            </p>
            <p className="relative mt-10 max-w-[12rem] text-sm font-semibold uppercase leading-6 tracking-[0.22em]">
              Technology
              <br />
              for a brighter
              <br />
              <span className="text-cyan-300">tomorrow</span>
            </p>
          </aside>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-10 lg:px-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <article className="bcl-card p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Talk to BaseCode Labs</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              We’re here to help you with web, mobile, ERP and digital solutions.
            </p>
            <ul className="mt-6 space-y-5 text-sm">
              <li className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                  <Mail className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </span>
                  <a
                    className="font-semibold text-blue-700 hover:underline"
                    href={`mailto:${COMPANY.email}`}
                  >
                    {COMPANY.email}
                  </a>
                  <span className="mt-0.5 block text-slate-500">Send us an email anytime.</span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Phone className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </span>
                  <a
                    className="font-semibold text-slate-900 hover:text-blue-700"
                    href={`tel:+91${COMPANY.phones[0]}`}
                  >
                    {COMPANY.phoneDisplay}
                  </a>
                  <span className="text-slate-500"> / </span>
                  <a
                    className="font-semibold text-slate-900 hover:text-blue-700"
                    href={`tel:+91${COMPANY.phones[1]}`}
                  >
                    +91 87784 63459
                  </a>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    WhatsApp
                  </span>
                  <a
                    className="font-semibold text-blue-700 hover:underline"
                    href={COMPANY.whatsapp}
                  >
                    Chat on WhatsApp
                  </a>
                  <span className="mt-0.5 block text-slate-500">
                    Get quick assistance on WhatsApp.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Building2 className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {COMPANY.registeredOffice.name}
                  </span>
                  <span className="font-semibold text-slate-900">{COMPANY.legalName}</span>
                  <span className="mt-0.5 block text-slate-600">
                    {COMPANY.registeredOffice.line1}
                    <br />
                    {COMPANY.registeredOffice.line2}
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                  <MapPin className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {COMPANY.operationalOffice.name}
                  </span>
                  <span className="font-semibold text-slate-900">Tura, Meghalaya</span>
                  <span className="mt-0.5 block text-slate-600">
                    {COMPANY.operationalOffice.line1}
                    <br />
                    {COMPANY.operationalOffice.line2}
                  </span>
                </span>
              </li>
            </ul>
            <p className="mt-6 flex items-start gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Typically responds within 24 hours.</strong>
                <span className="mt-0.5 block text-sky-800/80">
                  Enquiries become CRM leads in BaseCode Central.
                </span>
              </span>
            </p>
          </article>

          <ContactForm />
        </div>

        <aside className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">Not sure what you need?</p>
              <p className="text-sm text-slate-500">
                Talk to our team and get the right guidance for your institution or business.
              </p>
            </div>
          </div>
          <ul className="flex flex-1 flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-600">
            <li className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" /> Understand your requirements
            </li>
            <li className="inline-flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-600" /> Recommend the best solution
            </li>
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600" /> Provide clear next steps
            </li>
          </ul>
          <Link href="#enquiry" className="bcl-btn bcl-btn-primary shrink-0 gap-2">
            Let’s Talk
          </Link>
        </aside>
      </section>
    </main>
  );
}
