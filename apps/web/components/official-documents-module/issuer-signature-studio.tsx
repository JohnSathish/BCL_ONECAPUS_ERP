'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchOfficialDocumentIssuers,
  updateOfficialDocumentIssuer,
  uploadOfficialDocumentIssuerAsset,
} from '@/services/official-documents';
import { apiErrorMessage } from '@/utils/api-error';

export function IssuerSignatureStudio() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { signaturePath: string; sealPath: string }>>(
    {},
  );
  const [uploading, setUploading] = useState<string | null>(null);

  const issuers = useQuery({
    queryKey: ['official-documents', 'issuers'],
    queryFn: fetchOfficialDocumentIssuers,
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { signaturePath?: string; sealPath?: string };
    }) => updateOfficialDocumentIssuer(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['official-documents', 'issuers'] }),
  });

  const handleUpload = async (issuerId: string, kind: 'signature' | 'seal', file: File) => {
    setUploading(`${issuerId}-${kind}`);
    try {
      const updated = await uploadOfficialDocumentIssuerAsset(issuerId, kind, file);
      setDrafts((prev) => ({
        ...prev,
        [issuerId]: {
          signaturePath: updated.signaturePath ?? prev[issuerId]?.signaturePath ?? '',
          sealPath: updated.sealPath ?? prev[issuerId]?.sealPath ?? '',
        },
      }));
      void qc.invalidateQueries({ queryKey: ['official-documents', 'issuers'] });
    } finally {
      setUploading(null);
    }
  };

  if (issuers.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading issuers…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Digital Signatures & Seals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload signature and seal images for each issuer. They are applied automatically when
          generating official letter PDFs.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(issuers.data ?? []).map((issuer) => {
          const draft = drafts[issuer.id] ?? {
            signaturePath: issuer.signaturePath ?? '',
            sealPath: issuer.sealPath ?? '',
          };
          return (
            <IssuerAssetCard
              key={issuer.id}
              issuer={issuer}
              draft={draft}
              uploading={uploading}
              onDraftChange={(next) => setDrafts((prev) => ({ ...prev, [issuer.id]: next }))}
              onUpload={(kind, file) => void handleUpload(issuer.id, kind, file)}
              onSave={() =>
                updateMut.mutate({
                  id: issuer.id,
                  payload: {
                    signaturePath: draft.signaturePath || undefined,
                    sealPath: draft.sealPath || undefined,
                  },
                })
              }
              savePending={updateMut.isPending}
            />
          );
        })}
      </div>

      {updateMut.isError ? (
        <p className="text-sm text-destructive">
          {apiErrorMessage(updateMut.error, 'Save failed')}
        </p>
      ) : null}
    </div>
  );
}

function IssuerAssetCard({
  issuer,
  draft,
  uploading,
  onDraftChange,
  onUpload,
  onSave,
  savePending,
}: {
  issuer: { id: string; name: string; designation: string };
  draft: { signaturePath: string; sealPath: string };
  uploading: string | null;
  onDraftChange: (next: { signaturePath: string; sealPath: string }) => void;
  onUpload: (kind: 'signature' | 'seal', file: File) => void;
  onSave: () => void;
  savePending: boolean;
}) {
  const sigInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/85 p-4">
      <div>
        <p className="font-semibold">{issuer.name}</p>
        <p className="text-xs text-muted-foreground">{issuer.designation}</p>
      </div>

      <AssetField
        label="Signature"
        path={draft.signaturePath}
        uploading={uploading === `${issuer.id}-signature`}
        inputRef={sigInputRef}
        onPathChange={(signaturePath) => onDraftChange({ ...draft, signaturePath })}
        onUpload={(file) => onUpload('signature', file)}
      />

      <AssetField
        label="Seal"
        path={draft.sealPath}
        uploading={uploading === `${issuer.id}-seal`}
        inputRef={sealInputRef}
        onPathChange={(sealPath) => onDraftChange({ ...draft, sealPath })}
        onUpload={(file) => onUpload('seal', file)}
      />

      <Button type="button" size="sm" disabled={savePending} onClick={onSave}>
        <Save className="mr-2 h-4 w-4" />
        Save paths
      </Button>
    </div>
  );
}

function AssetField({
  label,
  path,
  uploading,
  inputRef,
  onPathChange,
  onUpload,
}: {
  label: string;
  path: string;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPathChange: (path: string) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
      </div>
      <input
        className="w-full rounded-xl border border-border px-3 py-2 text-xs font-mono"
        value={path}
        onChange={(e) => onPathChange(e.target.value)}
        placeholder="/uploads/tenants/.../signature.png"
      />
      {path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={path} alt={`${label} preview`} className="max-h-16" />
      ) : null}
    </div>
  );
}
