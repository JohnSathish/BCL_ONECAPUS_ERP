'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { ErpFormSection } from '@/components/erp/erp-workspace-shell';
import { STAFF_DOC_TYPES } from '@/components/staff-module/add-staff/constants';
import {
  GlassField,
  glassSelectClass,
} from '@/components/students-module/add-student/ui/glass-field';
import type { AddStaffDraft } from '@/components/staff-module/add-staff/types/draft';
import { Button } from '@/components/ui/button';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';

type Props = {
  draft: AddStaffDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStaffDraft>>;
};

export function StepDocuments({ draft, setDraft }: Props) {
  const [documentType, setDocumentType] = useState<string>(STAFF_DOC_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);

  const addDocument = () => {
    if (!file) return;
    setDraft((d) => ({
      ...d,
      pendingDocuments: [...d.pendingDocuments, { documentType, fileName: file.name }],
    }));
    setFile(null);
  };

  const removeDocument = (index: number) => {
    setDraft((d) => ({
      ...d,
      pendingDocuments: d.pendingDocuments.filter((_, i) => i !== index),
    }));
  };

  return (
    <ErpFormSection
      title="Documents"
      description="Upload supporting documents after staff is created"
    >
      <div className="flex flex-wrap items-end gap-2">
        <GlassField label="Document type">
          <select
            className={glassSelectClass}
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            {STAFF_DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {staffTypeLabel(t)}
              </option>
            ))}
          </select>
        </GlassField>
        <GlassField label="File">
          <input
            type="file"
            className="text-xs"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </GlassField>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={addDocument}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Queue
        </Button>
      </div>

      {draft.pendingDocuments.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border/60 text-xs">
          {draft.pendingDocuments.map((doc, i) => (
            <li
              key={`${doc.documentType}-${i}`}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span>
                {staffTypeLabel(doc.documentType)} — {doc.fileName}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => removeDocument(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Document files will be uploaded after the staff record is created.
        </p>
      )}
    </ErpFormSection>
  );
}
