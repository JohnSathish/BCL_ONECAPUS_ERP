'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import {
  createMySubmission,
  uploadMySubmissionFile,
  submitMySubmission,
} from '@/services/journals-portal';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect } from 'react';

export default function NewSubmissionPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [title, setTitle] = useState('');
  const [abstractText, setAbstractText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) router.replace('/journals-portal/login');
  }, [session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const draft = await createMySubmission({
        title,
        abstract: abstractText || undefined,
        coAuthors: authorName ? [{ fullName: authorName, isCorresponding: true }] : undefined,
      });
      if (file) {
        await uploadMySubmissionFile(draft.id, file, 'MANUSCRIPT');
      }
      await submitMySubmission(draft.id);
      router.push(`/journals-portal/author/submissions/${draft.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create submission'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-serif text-3xl font-semibold text-[#0A2342]">New submission</h1>
        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <Input
            required
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="Corresponding author name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Abstract"
            value={abstractText}
            onChange={(e) => setAbstractText(e.target.value)}
          />
          <Input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button type="submit" disabled={loading || !title}>
            {loading ? 'Submitting…' : 'Create & submit'}
          </Button>
        </form>
      </div>
    </JournalPublicShell>
  );
}
