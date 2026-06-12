'use client';

import { Check, User } from 'lucide-react';

import { computeProfileCompletion } from '@/components/students-module/add-student/utils/completion';
import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import { cn } from '@/utils/cn';

type Props = {
  draft: AddStudentDraft;
  stepLabel: string;
  savedLabel?: string;
  children: React.ReactNode;
};

export function AddStudentPageShell({ draft, stepLabel, savedLabel, children }: Props) {
  const completion = computeProfileCompletion(draft);

  return (
    <div className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
        {draft.photoPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.photoPreviewUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-primary/20"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {draft.fullName || 'New student admission'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {draft.applicationNumber}
            {stepLabel ? ` · ${stepLabel}` : ''}
            {savedLabel ? (
              <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                <Check className="h-3 w-3" aria-hidden />
                {savedLabel}
              </span>
            ) : null}
          </p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          PROVISIONAL
        </span>
        <div className="w-full sm:w-auto sm:min-w-[140px]">
          <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span>{completion}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all',
              )}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
