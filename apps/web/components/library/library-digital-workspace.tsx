'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createDigitalAsset,
  createResearchItem,
  fetchDigitalAssets,
  fetchPendingResearch,
  fetchPopularDigitalAssets,
  fetchResearchItems,
  publishDigitalAsset,
  reviewResearchItem,
  submitResearchItem,
  syncQuestionBankToLibrary,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';

type DigitalProps = { mode: 'digital' };
type ResearchProps = { mode: 'research' };
type Props = DigitalProps | ResearchProps;

const ASSET_TYPES = [
  'PDF',
  'EBOOK',
  'RESEARCH_PAPER',
  'QUESTION_PAPER',
  'LECTURE_NOTES',
  'LAB_MANUAL',
  'MAGAZINE',
  'JOURNAL',
];
const RESEARCH_TYPES = [
  'PUBLICATION',
  'THESIS',
  'DISSERTATION',
  'PATENT',
  'ARTICLE',
  'PROJECT',
  'INTERNSHIP_REPORT',
];

export function LibraryDigitalWorkspace({ mode }: Props) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    author: '',
    assetType: mode === 'digital' ? 'PDF' : 'THESIS',
    abstract: '',
  });

  const digital = useQuery({
    queryKey: ['library', 'digital'],
    queryFn: () =>
      fetchDigitalAssets({ limit: 50, status: mode === 'digital' ? undefined : undefined }),
    enabled: enabled && mode === 'digital',
  });

  const popular = useQuery({
    queryKey: ['library', 'digital', 'popular'],
    queryFn: fetchPopularDigitalAssets,
    enabled: enabled && mode === 'digital',
  });

  const research = useQuery({
    queryKey: ['library', 'research'],
    queryFn: () => fetchResearchItems({ limit: 50 }),
    enabled: enabled && mode === 'research',
  });

  const pending = useQuery({
    queryKey: ['library', 'research', 'pending'],
    queryFn: fetchPendingResearch,
    enabled: enabled && mode === 'research',
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('title', form.title);
      if (form.author) fd.append('author', form.author);
      if (mode === 'research') {
        fd.append('itemType', form.assetType);
        if (form.abstract) fd.append('abstract', form.abstract);
        const file = fileRef.current?.files?.[0];
        if (file) fd.append('file', file);
        return createResearchItem(fd);
      }
      fd.append('assetType', form.assetType);
      const file = fileRef.current?.files?.[0];
      if (file) fd.append('file', file);
      return createDigitalAsset(fd);
    },
    onSuccess: () => {
      setMessage('Uploaded successfully');
      setForm({
        title: '',
        author: '',
        assetType: mode === 'digital' ? 'PDF' : 'THESIS',
        abstract: '',
      });
      if (fileRef.current) fileRef.current.value = '';
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => publishDigitalAsset(id),
    onSuccess: () => {
      setMessage('Published');
      void qc.invalidateQueries({ queryKey: ['library', 'digital'] });
    },
  });

  const syncQbMut = useMutation({
    mutationFn: syncQuestionBankToLibrary,
    onSuccess: (data: { synced?: number }) => {
      setMessage(`Synced ${(data as { synced?: number }).synced ?? 0} question papers`);
      void qc.invalidateQueries({ queryKey: ['library', 'digital'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => submitResearchItem(id),
    onSuccess: () => {
      setMessage('Submitted for review');
      void qc.invalidateQueries({ queryKey: ['library', 'research'] });
    },
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      reviewResearchItem(id, action),
    onSuccess: () => {
      setMessage('Review recorded');
      void qc.invalidateQueries({ queryKey: ['library', 'research'] });
    },
  });

  if (mode === 'digital') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Digital Library</h1>
          <Button
            variant="outline"
            size="sm"
            disabled={syncQbMut.isPending}
            onClick={() => syncQbMut.mutate()}
          >
            Sync Question Bank
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-medium">Upload resource</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              placeholder="Author"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
            <select
              className="rounded-md border px-2 py-2 text-sm"
              value={form.assetType}
              onChange={(e) => setForm({ ...form, assetType: e.target.value })}
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.epub" className="text-sm" />
            <Button
              disabled={!form.title || uploadMut.isPending}
              onClick={() => uploadMut.mutate()}
            >
              Upload
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Catalogue ({digital.data?.total ?? 0})</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Downloads</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {digital.data?.items.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.title}</td>
                    <td className="p-2">{a.assetType}</td>
                    <td className="p-2">{a.status}</td>
                    <td className="p-2">{a.downloadCount ?? 0}</td>
                    <td className="p-2">
                      {a.status === 'DRAFT' ? (
                        <Button size="sm" variant="outline" onClick={() => publishMut.mutate(a.id)}>
                          Publish
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {popular.data?.length ? (
          <div>
            <h2 className="mb-2 text-sm font-medium">Popular downloads</h2>
            <ul className="space-y-1 text-sm">
              {popular.data.map((a) => (
                <li key={a.id}>
                  {a.title} — {a.downloadCount ?? 0} downloads
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Research Repository</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Submit research</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="rounded-md border px-2 py-2 text-sm"
            value={form.assetType}
            onChange={(e) => setForm({ ...form, assetType: e.target.value })}
          >
            {RESEARCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Input
            placeholder="Abstract"
            value={form.abstract}
            className="md:col-span-2"
            onChange={(e) => setForm({ ...form, abstract: e.target.value })}
          />
          <input ref={fileRef} type="file" accept=".pdf" className="text-sm md:col-span-2" />
          <Button disabled={!form.title || uploadMut.isPending} onClick={() => uploadMut.mutate()}>
            Upload draft
          </Button>
        </div>
      </div>

      {(pending.data?.length ?? 0) > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-medium">Pending review ({pending.data?.length})</h2>
          <ul className="space-y-2">
            {pending.data?.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"
              >
                <span>
                  {item.title} · {item.itemType}
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => reviewMut.mutate({ id: item.id, action: 'APPROVE' })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewMut.mutate({ id: item.id, action: 'REJECT' })}
                  >
                    Reject
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium">Repository ({research.data?.total ?? 0})</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {research.data?.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.title}</td>
                  <td className="p-2">{item.itemType}</td>
                  <td className="p-2">{item.status}</td>
                  <td className="p-2">
                    {item.status === 'DRAFT' || item.status === 'REJECTED' ? (
                      <Button size="sm" variant="outline" onClick={() => submitMut.mutate(item.id)}>
                        Submit
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
