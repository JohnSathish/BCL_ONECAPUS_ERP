'use client';

import { FileUp, Trash2 } from 'lucide-react';

import { ErpFormSection } from '@/components/erp/erp-workspace-shell';
import {
  ADMISSION_DOCUMENT_SLOTS,
  admissionDocumentLabel,
} from '@/components/students-module/add-student/constants/documents';
import type {
  AddStudentDraft,
  PendingDocument,
} from '@/components/students-module/add-student/types/draft';
import { cn } from '@/utils/cn';

type Props = {
  draft: AddStudentDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStudentDraft>>;
  documentFiles: Record<string, File>;
  setDocumentFiles: React.Dispatch<React.SetStateAction<Record<string, File>>>;
};

function newDocumentId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function StepDocuments({ draft, setDraft, documentFiles, setDocumentFiles }: Props) {
  const addDocument = (documentType: string, file: File) => {
    const id = newDocumentId();
    setDocumentFiles((prev) => ({ ...prev, [id]: file }));
    setDraft((d) => ({
      ...d,
      pendingDocuments: [
        ...d.pendingDocuments,
        { id, documentType, fileName: file.name } satisfies PendingDocument,
      ],
    }));
  };

  const removeDocument = (id: string) => {
    setDocumentFiles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDraft((d) => ({
      ...d,
      pendingDocuments: d.pendingDocuments.filter((doc) => doc.id !== id),
    }));
  };

  const docsForType = (documentType: string) =>
    draft.pendingDocuments.filter((doc) => doc.documentType === documentType);

  const missingFiles = draft.pendingDocuments.some((doc) => !documentFiles[doc.id]);

  return (
    <div className="space-y-4">
      {missingFiles ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Some queued documents need to be selected again (files are not kept when you resume a
          saved draft).
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Upload attested copies as listed below. Files are saved when you complete admission. You can
        also upload later from the student profile.
      </p>

      {ADMISSION_DOCUMENT_SLOTS.map((slot) => {
        const uploaded = docsForType(slot.type);
        const hidden = 'whenCuet' in slot && slot.whenCuet && !draft.cuetApplied;
        if (hidden) return null;

        return (
          <ErpFormSection key={slot.type} title={slot.label} description={slot.description}>
            <div className="space-y-2">
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5',
                )}
              >
                <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Choose file</span>
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    addDocument(slot.type, file);
                    e.target.value = '';
                  }}
                />
              </label>

              {'multiple' in slot && slot.multiple ? (
                <p className="text-[10px] text-muted-foreground">
                  You may upload multiple files for this category.
                </p>
              ) : null}

              {uploaded.length > 0 ? (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-xs">
                  {uploaded.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate" title={doc.fileName}>
                        {doc.fileName}
                        {!documentFiles[doc.id] ? (
                          <span className="ml-1 text-amber-600"> (re-select file)</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${doc.fileName}`}
                        onClick={() => removeDocument(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-muted-foreground">No file uploaded yet.</p>
              )}
            </div>
          </ErpFormSection>
        );
      })}

      {draft.pendingDocuments.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {draft.pendingDocuments.length} file
          {draft.pendingDocuments.length === 1 ? '' : 's'} queued —{' '}
          {Array.from(
            new Set(draft.pendingDocuments.map((d) => admissionDocumentLabel(d.documentType))),
          ).join(', ')}
        </p>
      ) : null}
    </div>
  );
}
