'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Ticket, HelpCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createStudentTicket,
  fetchStudentSupportFaq,
  fetchStudentSupportMeta,
  fetchStudentTickets,
  rateStudentTicket,
  SUPPORT_CATEGORIES,
} from '@/services/support-centre';
import { apiErrorMessage } from '@/utils/api-error';

export function StudentSupportHome() {
  const metaQ = useQuery({
    queryKey: ['student', 'support', 'meta'],
    queryFn: fetchStudentSupportMeta,
  });
  const settings = metaQ.data?.settings;

  const cards = [
    {
      href: '/student/support/chat',
      title: 'Live Chat',
      desc: 'Chat with Admissions, Accounts, Exam Cell and more',
      icon: MessageCircle,
    },
    {
      href: '/student/support/tickets',
      title: 'My Tickets',
      desc: 'Raise and track support tickets',
      icon: Ticket,
    },
    {
      href: '/student/support/faq',
      title: 'FAQs',
      desc: 'Answers to common questions',
      icon: HelpCircle,
    },
    {
      href: '/student/support/contact',
      title: 'Contact College',
      desc: 'Phone, email and support hours',
      icon: Phone,
    },
  ];

  return (
    <div className="space-y-6">
      {settings?.welcomeMessage ? (
        <p className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          {settings.welcomeMessage}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <c.icon className="mb-3 h-6 w-6 text-primary" />
            <p className="font-semibold">{c.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function StudentSupportFaq() {
  const [q, setQ] = useState('');
  const faqQ = useQuery({
    queryKey: ['student', 'support', 'faq', q],
    queryFn: () => fetchStudentSupportFaq(q || undefined),
  });

  return (
    <div className="space-y-4">
      <Input placeholder="Search FAQs…" value={q} onChange={(e) => setQ(e.target.value)} />
      {(faqQ.data ?? []).map((cat) => (
        <div key={cat.id} className="rounded-2xl border p-4">
          <h3 className="font-semibold">{cat.name}</h3>
          <ul className="mt-3 space-y-3">
            {cat.articles.map((a) => (
              <li key={a.id}>
                <p className="text-sm font-medium">{a.question}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!faqQ.isLoading && !(faqQ.data ?? []).length ? (
        <p className="text-sm text-muted-foreground">No FAQs found.</p>
      ) : null}
    </div>
  );
}

export function StudentSupportContact() {
  const metaQ = useQuery({
    queryKey: ['student', 'support', 'meta'],
    queryFn: fetchStudentSupportMeta,
  });
  const s = metaQ.data?.settings;
  return (
    <div className="space-y-3 rounded-2xl border p-6 text-sm">
      <p>
        <span className="text-muted-foreground">Email: </span>
        {s?.contactEmail ?? '—'}
      </p>
      <p>
        <span className="text-muted-foreground">Phone: </span>
        {s?.contactPhone ?? '—'}
      </p>
      <p>
        <span className="text-muted-foreground">Hours: </span>
        {s?.supportHours ?? '—'}
      </p>
      <Button asChild className="mt-2">
        <Link href="/student/support/chat">Start Live Chat</Link>
      </Button>
    </div>
  );
}

export function StudentSupportTickets() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [error, setError] = useState('');

  const listQ = useQuery({
    queryKey: ['student', 'support', 'tickets'],
    queryFn: fetchStudentTickets,
  });

  const createMut = useMutation({
    mutationFn: () => createStudentTicket({ subject, description, category, priority: 'MEDIUM' }),
    onSuccess: async () => {
      setSubject('');
      setDescription('');
      await qc.invalidateQueries({ queryKey: ['student', 'support', 'tickets'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not create ticket')),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border p-4">
        <h3 className="font-semibold">Raise a ticket</h3>
        <div>
          <Label>Category</Label>
          <select
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          disabled={!subject.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          Submit ticket
        </Button>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">My tickets</h3>
        {(listQ.data ?? []).map((t) => (
          <div key={t.id} className="rounded-xl border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-xs text-muted-foreground">{t.ticketNo}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {t.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-1 font-medium">{t.subject}</p>
            <p className="text-xs text-muted-foreground">{t.category}</p>
            {['RESOLVED', 'CLOSED'].includes(t.status) && !t.satisfactionScore ? (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="text-amber-500"
                    onClick={() =>
                      void rateStudentTicket(t.id, n).then(() =>
                        qc.invalidateQueries({
                          queryKey: ['student', 'support', 'tickets'],
                        }),
                      )
                    }
                  >
                    ★
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export { StudentLiveChatEnterprise as StudentSupportChat } from './student-live-chat-enterprise';
