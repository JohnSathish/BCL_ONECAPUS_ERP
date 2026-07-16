'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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

const CATEGORIES = [
  'Strategy papers',
  'Review articles',
  'Research papers',
  'Short communications',
  'Maiden reports',
] as const;

export default function NewSubmissionPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[2]);
  const [abstractText, setAbstractText] = useState('');
  const [keywords, setKeywords] = useState('');
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
    const keywordList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywordList.length > 0 && (keywordList.length < 3 || keywordList.length > 5)) {
      setError('Please provide 3–5 keywords (comma-separated), or leave blank for now.');
      return;
    }
    if (abstractText.trim()) {
      const words = abstractText.trim().split(/\s+/).length;
      if (words < 120 || words > 250) {
        setError(`Abstract should be 120–250 words (currently ${words}).`);
        return;
      }
    }
    setLoading(true);
    try {
      const draft = await createMySubmission({
        title,
        abstract: abstractText || undefined,
        keywords: keywordList.length ? keywordList : undefined,
        coverLetter: `Article category: ${category}`,
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
        <p className="jp-eyebrow">Author desk</p>
        <h1 className="jp-serif mt-2 text-3xl font-semibold text-[var(--jp-ink)]">
          New submission
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--jp-muted)]">
          Submit your manuscript through this portal — Google Forms are no longer used. Please read
          the{' '}
          <Link
            href="/journals-portal/author-guidelines"
            className="font-semibold text-[var(--jp-gold)] hover:underline"
          >
            Author Guidelines
          </Link>{' '}
          (categories, abstract length, keywords, figures/tables, APA references) before uploading.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--jp-ink)]">Title</span>
            <Input
              required
              placeholder="Running sentence case title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--jp-ink)]">Category</span>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--jp-ink)]">
              Corresponding author name
            </span>
            <Input
              placeholder="Full name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--jp-ink)]">
              Abstract (120–250 words)
            </span>
            <textarea
              className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Single paragraph preferred"
              value={abstractText}
              onChange={(e) => setAbstractText(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--jp-ink)]">
              Keywords (3–5, comma-separated)
            </span>
            <Input
              placeholder="ecology, biodiversity, Meghalaya"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--jp-ink)]">Manuscript PDF</span>
            <Input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="mt-1 block text-xs text-[var(--jp-muted)]">
              Follow the journal template. Provide tables/figures as separate files when possible
              (Excel for tables; figures ≥ 300 dpi).
            </span>
          </label>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button type="submit" disabled={loading || !title}>
            {loading ? 'Submitting…' : 'Create & submit'}
          </Button>
        </form>
      </div>
    </JournalPublicShell>
  );
}
