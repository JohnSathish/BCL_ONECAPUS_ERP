'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  addAccessionCopies,
  fetchLibraryBook,
  updateLibraryCopyCirculation,
} from '@/services/library';
import type { LibraryBook, LibraryBookCopy } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import {
  COPY_TYPES,
  COPY_TYPE_LABELS,
  DEFAULT_COPY_ISSUE,
  type CopyType,
} from './library-copy-rules';

export function CopyCirculationEditor({
  book,
  canManage,
  onUpdated,
}: {
  book: LibraryBook;
  canManage: boolean;
  onUpdated: (book: LibraryBook) => void;
}) {
  const qc = useQueryClient();
  const [count, setCount] = useState('1');
  const [copyType, setCopyType] = useState<CopyType>('GENERAL');
  const [issueAllowed, setIssueAllowed] = useState(true);
  const [location, setLocation] = useState('');
  const [notice, setNotice] = useState('');

  const add = useMutation({
    mutationFn: () => {
      const copies = Math.min(100, Math.max(1, Number(count) || 1));
      return addAccessionCopies(
        book.id,
        Array.from({ length: copies }, () => ({
          copyType,
          issueAllowed,
          location: location.trim() || undefined,
          availability: 'ON_SHELF',
          condition: 'NEW',
        })),
      );
    },
    onSuccess: (saved) => {
      onUpdated(saved);
      setNotice(`Added ${count} ${Number(count) === 1 ? 'copy' : 'copies'}.`);
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">Physical copies</h4>
      <ul className="mt-2 space-y-2">
        {(book.copies ?? []).map((copy) => (
          <CopyRuleRow
            key={copy.id}
            copy={copy}
            canManage={canManage}
            onSaved={() => {
              void fetchLibraryBook(book.id).then(onUpdated);
              void qc.invalidateQueries({ queryKey: ['library'] });
              setNotice('Copy circulation updated.');
            }}
            onError={(message) => setNotice(message)}
          />
        ))}
      </ul>
      {canManage ? (
        <div className="mt-3 grid gap-2 rounded-lg border bg-slate-50 p-3 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            Additional copies
            <input
              className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Copy type
            <select
              className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm"
              value={copyType}
              onChange={(event) => {
                const next = event.target.value as CopyType;
                setCopyType(next);
                setIssueAllowed(DEFAULT_COPY_ISSUE[next]);
              }}
            >
              {COPY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {COPY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Issue
            <select
              className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm"
              value={issueAllowed ? 'yes' : 'no'}
              onChange={(event) => setIssueAllowed(event.target.value === 'yes')}
            >
              <option value="yes">Allowed</option>
              <option value="no">Not allowed</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Shelf
            <input
              className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="button" disabled={add.isPending} onClick={() => add.mutate()}>
              {add.isPending ? 'Adding…' : 'Add copies'}
            </Button>
          </div>
        </div>
      ) : null}
      {notice ? <p className="mt-2 text-sm text-slate-600">{notice}</p> : null}
    </div>
  );
}

function CopyRuleRow({
  copy,
  canManage,
  onSaved,
  onError,
}: {
  copy: LibraryBookCopy;
  canManage: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [copyType, setCopyType] = useState(
    COPY_TYPES.includes(copy.copyType as CopyType) ? (copy.copyType as CopyType) : '',
  );
  const [issue, setIssue] = useState(
    copy.issueAllowed == null ? '' : copy.issueAllowed ? 'yes' : 'no',
  );
  const [location, setLocation] = useState(copy.shelvingLocation ?? '');
  const save = useMutation({
    mutationFn: () =>
      updateLibraryCopyCirculation(copy.id, {
        ...(copyType ? { copyType } : {}),
        ...(issue === 'yes' || issue === 'no' ? { issueAllowed: issue === 'yes' } : {}),
        location,
      }),
    onSuccess: () => onSaved(),
    onError: (error) => onError(apiErrorMessage(error)),
  });
  return (
    <li className="rounded border px-2 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs">{copy.accessionNumber || copy.barcode}</span>
        <span>{copy.status}</span>
      </div>
      {canManage ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <select
            className="h-8 rounded border px-1"
            value={copyType}
            onChange={(event) => setCopyType(event.target.value)}
          >
            <option value="">Not set</option>
            {COPY_TYPES.map((type) => (
              <option key={type} value={type}>
                {COPY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded border px-1"
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
          >
            <option value="">Not set</option>
            <option value="yes">Issue allowed</option>
            <option value="no">Issue not allowed</option>
          </select>
          <input
            className="h-8 rounded border px-2"
            value={location}
            placeholder="Shelf"
            onChange={(event) => setLocation(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Save copy
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {copy.copyType
            ? (COPY_TYPE_LABELS[copy.copyType as CopyType] ?? copy.copyType)
            : 'Copy type not set'}
          {' · '}
          {copy.issueAllowed == null
            ? 'Issue not set'
            : copy.issueAllowed
              ? 'Issue allowed'
              : 'Issue not allowed'}
        </p>
      )}
    </li>
  );
}
