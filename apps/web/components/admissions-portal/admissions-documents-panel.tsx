'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, FileWarning, Loader2, Upload } from 'lucide-react';
import {
  DOC_SLOTS,
  UPLOAD_DOC_SLOTS,
  findMissingRequiredDocuments,
  resolveRequiredDocumentSlots,
} from '@/components/admissions-portal/constants';
import { fetchApplicantMe, uploadApplicantDocument } from '@/services/admissions-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { applicantPhotoUrl } from '@/components/admissions-portal/utils';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Props = {
  compact?: boolean;
};

export function AdmissionsDocumentsPanel({ compact = false }: Props) {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['applicant-me'],
    queryFn: fetchApplicantMe,
    enabled,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ slotCode, file }: { slotCode: string; file: File }) =>
      uploadApplicantDocument(slotCode, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applicant-me'] });
    },
  });

  const readOnly = data?.readOnly ?? false;
  const documents = data?.application.documents ?? [];
  const formData = (data?.application.formData ?? {}) as Record<string, unknown>;
  const photoUrl = applicantPhotoUrl(documents);
  const requiredSlots = resolveRequiredDocumentSlots(formData);
  const missingDocs = findMissingRequiredDocuments(
    documents.map((d) => d.slotCode),
    formData,
  );
  const uploadedCount = requiredSlots.filter((code) =>
    documents.some((d) => d.slotCode === code),
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading documents…
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="font-semibold text-[#1a2b4b]">Upload progress</p>
          <p className="text-sm text-slate-600">
            {uploadedCount} of {requiredSlots.length} required documents uploaded
          </p>
        </div>
        {!readOnly ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/admissions-portal/application">Open form uploads step</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DOC_SLOTS.map((slot) => {
          const doc = documents.find((d) => d.slotCode === slot.code);
          const status = doc?.verificationStatus ?? (doc ? 'UPLOADED' : 'MISSING');
          const isPhoto = slot.code === 'PHOTO';

          return (
            <div
              key={slot.code}
              className={cn(
                'rounded-xl border bg-white p-4 shadow-sm',
                doc
                  ? 'border-emerald-200'
                  : slot.required
                    ? 'border-amber-200'
                    : 'border-slate-200',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[#1a2b4b]">
                    {slot.label}
                    {slot.required ? ' *' : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {doc ? status.replace(/_/g, ' ') : 'Not uploaded'}
                  </p>
                </div>
                {doc ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : slot.required ? (
                  <FileWarning className="h-5 w-5 shrink-0 text-amber-500" />
                ) : null}
              </div>

              {isPhoto && photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  className="mt-3 h-20 w-20 rounded-lg border object-cover"
                />
              ) : null}

              {doc?.fileUrl && !isPhoto ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#2563eb] hover:underline"
                >
                  View file <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}

              {!readOnly && (!isPhoto || !doc) ? (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[#2563eb]">
                  <Upload className="h-3.5 w-3.5" />
                  {doc ? 'Replace file' : 'Upload file'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    disabled={uploadMutation.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      uploadMutation.mutate({ slotCode: slot.code, file });
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>

      {uploadMutation.error ? (
        <p className="text-sm text-red-600">
          {apiErrorMessage(uploadMutation.error, 'Upload failed')}
        </p>
      ) : null}

      {!readOnly && missingDocs.length > 0 ? (
        <p className="text-sm text-amber-800">
          Still required:{' '}
          {missingDocs
            .map((code) => DOC_SLOTS.find((slot) => slot.code === code)?.label ?? code)
            .join(', ')}
          . You can also upload from step 6 of the{' '}
          <Link
            href="/admissions-portal/application"
            className="font-medium text-[#2563eb] hover:underline"
          >
            application form
          </Link>
          .
        </p>
      ) : null}

      {!compact ? (
        <p className="text-xs text-slate-500">
          Optional slots:{' '}
          {UPLOAD_DOC_SLOTS.filter((s) => !s.required)
            .map((s) => s.label)
            .join(', ')}
        </p>
      ) : null}
    </div>
  );
}
