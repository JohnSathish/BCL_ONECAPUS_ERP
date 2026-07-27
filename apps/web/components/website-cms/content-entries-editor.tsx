'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/utils/api-error';
import {
  createWebsiteContentEntry,
  createWebsiteContentType,
  fetchWebsiteContentEntries,
  fetchWebsiteContentTypes,
  updateWebsiteContentEntry,
} from '@/services/website-cms';

const CPT_DEFAULTS: Record<
  string,
  { name: string; slug: string; description: string; fields: Array<Record<string, unknown>> }
> = {
  news: {
    name: 'News',
    slug: 'news',
    description: 'College news and announcements',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'richText', required: true },
      { key: 'image', label: 'Featured image', type: 'image', required: false },
      { key: 'category', label: 'Category', type: 'text', required: false },
    ],
  },
  testimonials: {
    name: 'Testimonials',
    slug: 'testimonials',
    description: 'Student and alumni voices',
    fields: [
      { key: 'quote', label: 'Quote', type: 'richText', required: true },
      { key: 'department', label: 'Department', type: 'text', required: true },
      { key: 'graduationYear', label: 'Graduation year', type: 'text', required: false },
      { key: 'status', label: 'Current status', type: 'text', required: false },
      { key: 'photoSrc', label: 'Photo URL', type: 'image', required: false },
      { key: 'rating', label: 'Rating', type: 'text', required: false },
    ],
  },
  'flash-news': {
    name: 'Flash News',
    slug: 'flash-news',
    description: 'Short ticker / flash items',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'href', label: 'Link', type: 'text', required: false },
    ],
  },
  announcements: {
    name: 'Announcements',
    slug: 'announcements',
    description: 'Campus announcements',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'richText', required: false },
      { key: 'href', label: 'Link', type: 'text', required: false },
    ],
  },
};

type EntryRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  data: Record<string, unknown>;
  updatedAt: string;
};

export function ContentEntriesEditor({
  typeSlug,
  onMessage,
}: {
  typeSlug: string;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const defaults = CPT_DEFAULTS[typeSlug] ?? {
    name: typeSlug,
    slug: typeSlug,
    description: `${typeSlug} entries`,
    fields: [{ key: 'summary', label: 'Summary', type: 'text', required: false }],
  };
  const types = useQuery({
    queryKey: ['website', 'content-types'],
    queryFn: fetchWebsiteContentTypes,
  });
  const contentType = useMemo(
    () => types.data?.find((row) => row.slug === defaults.slug),
    [types.data, defaults.slug],
  );
  const entries = useQuery({
    queryKey: ['website', 'content-entries', contentType?.id],
    queryFn: () => fetchWebsiteContentEntries(contentType!.id),
    enabled: Boolean(contentType?.id),
  });

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [search, setSearch] = useState('');

  const ensureType = useMutation({
    mutationFn: () =>
      createWebsiteContentType({
        name: defaults.name,
        slug: defaults.slug,
        description: defaults.description,
        fields: defaults.fields as never,
        entryCount: 0,
      }),
    onSuccess: () => {
      onMessage(`${defaults.name} content type ready.`);
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-types'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not create content type')),
  });

  const create = useMutation({
    mutationFn: () =>
      createWebsiteContentEntry(contentType!.id, {
        title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'DRAFT',
        data: { summary, quote: summary, body: summary },
      }),
    onSuccess: () => {
      setTitle('');
      setSummary('');
      onMessage('Entry created as draft.');
      void queryClient.invalidateQueries({
        queryKey: ['website', 'content-entries', contentType?.id],
      });
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-types'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not create entry')),
  });

  const publish = useMutation({
    mutationFn: (id: string) => updateWebsiteContentEntry(id, { status: 'PUBLISHED' }),
    onSuccess: () => {
      onMessage('Entry published.');
      void queryClient.invalidateQueries({
        queryKey: ['website', 'content-entries', contentType?.id],
      });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not publish entry')),
  });

  if (!types.data) {
    return <p className="text-sm text-muted-foreground">Loading content types…</p>;
  }

  if (!contentType) {
    return (
      <CompactCard>
        <CompactCardHeader title={defaults.name} description={defaults.description} />
        <CompactCardBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No <code>{defaults.slug}</code> content type yet. Create it to manage entries here.
          </p>
          <Button disabled={ensureType.isPending} onClick={() => ensureType.mutate()}>
            Create {defaults.name} type
          </Button>
        </CompactCardBody>
      </CompactCard>
    );
  }

  const rows = (entries.data ?? []) as EntryRow[];
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const summaryText = String(row.data?.summary ?? row.data?.quote ?? '');
      const haystack = `${row.title} ${row.slug} ${row.status} ${summaryText}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title={contentType.name}
          description={`${contentType.entryCount} entries · edit and publish without a code deploy.`}
        />
        <CompactCardBody className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
          />
          <Input
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Summary / quote"
          />
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
            Add draft
          </Button>
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader
          title="Entries"
          description={
            search.trim() ? `Showing ${filteredRows.length} of ${rows.length}` : undefined
          }
        />
        <CompactCardBody className="space-y-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${defaults.name.toLowerCase()} by title, slug, or summary…`}
            aria-label={`Search ${defaults.name} entries`}
          />
          {filteredRows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
            >
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">/{row.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{row.status}</Badge>
                {row.status !== 'PUBLISHED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={publish.isPending}
                    onClick={() => publish.mutate(row.id)}
                  >
                    Publish
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!filteredRows.length ? (
            <p className="text-sm text-muted-foreground">
              {rows.length ? 'No entries match your search.' : 'No entries yet.'}
            </p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
