'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OfficialDocumentsShell } from '@/components/official-documents-module/official-documents-shell';
import {
  fetchOfficialDocumentIssuers,
  updateOfficialDocumentIssuer,
  uploadOfficialDocumentIssuerAsset,
  type OfficialDocumentIssuer,
} from '@/services/official-documents';
import { apiErrorMessage } from '@/utils/api-error';

type IssuerDraft = {
  name: string;
  designation: string;
  phone: string;
  email: string;
  signaturePath: string;
  sealPath: string;
};

function draftFromIssuer(issuer: OfficialDocumentIssuer): IssuerDraft {
  return {
    name: issuer.name ?? '',
    designation: issuer.designation ?? '',
    phone: issuer.phone ?? '',
    email: issuer.email ?? '',
    signaturePath: issuer.signaturePath ?? '',
    sealPath: issuer.sealPath ?? '',
  };
}

export function IssuerSignatureStudio() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, IssuerDraft>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const issuers = useQuery({
    queryKey: ['official-documents', 'issuers'],
    queryFn: fetchOfficialDocumentIssuers,
  });

  useEffect(() => {
    if (!issuers.data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const issuer of issuers.data) {
        if (!next[issuer.id]) next[issuer.id] = draftFromIssuer(issuer);
      }
      return next;
    });
  }, [issuers.data]);

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{
        name: string;
        designation: string;
        phone: string | null;
        email: string | null;
        signaturePath: string;
        sealPath: string;
      }>;
    }) => updateOfficialDocumentIssuer(id, payload),
    onSuccess: (_data, vars) => {
      setSavedId(vars.id);
      void qc.invalidateQueries({ queryKey: ['official-documents', 'issuers'] });
    },
  });

  const handleUpload = async (issuerId: string, kind: 'signature' | 'seal', file: File) => {
    setUploading(`${issuerId}-${kind}`);
    try {
      const updated = await uploadOfficialDocumentIssuerAsset(issuerId, kind, file);
      setDrafts((prev) => ({
        ...prev,
        [issuerId]: {
          ...(prev[issuerId] ?? draftFromIssuer(updated)),
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
      <OfficialDocumentsShell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading issuers…
        </p>
      </OfficialDocumentsShell>
    );
  }

  return (
    <OfficialDocumentsShell title="Digital Signatures">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Digital Signatures & Seals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update Principal / Vice Principal names and contact details when officers change. The
            letterhead mobile and email on each PDF follow the <strong>issuing officer</strong>{' '}
            selected for that notice.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {(issuers.data ?? []).map((issuer) => {
            const draft = drafts[issuer.id] ?? draftFromIssuer(issuer);
            return (
              <IssuerAssetCard
                key={issuer.id}
                issuer={issuer}
                draft={draft}
                uploading={uploading}
                saved={savedId === issuer.id && updateMut.isSuccess}
                onDraftChange={(next) => {
                  setSavedId(null);
                  setDrafts((prev) => ({ ...prev, [issuer.id]: next }));
                }}
                onUpload={(kind, file) => void handleUpload(issuer.id, kind, file)}
                onSave={() =>
                  updateMut.mutate({
                    id: issuer.id,
                    payload: {
                      name: draft.name.trim(),
                      designation: draft.designation.trim(),
                      phone: draft.phone.trim() || null,
                      email: draft.email.trim() || null,
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
    </OfficialDocumentsShell>
  );
}

function IssuerAssetCard({
  issuer,
  draft,
  uploading,
  saved,
  onDraftChange,
  onUpload,
  onSave,
  savePending,
}: {
  issuer: OfficialDocumentIssuer;
  draft: IssuerDraft;
  uploading: string | null;
  saved: boolean;
  onDraftChange: (next: IssuerDraft) => void;
  onUpload: (kind: 'signature' | 'seal', file: File) => void;
  onSave: () => void;
  savePending: boolean;
}) {
  const sigInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);
  const roleLabel =
    issuer.roleCode === 'PRINCIPAL'
      ? 'Principal'
      : issuer.roleCode === 'VICE_PRINCIPAL'
        ? 'Vice Principal'
        : issuer.roleCode?.replaceAll('_', ' ') || 'Issuer';

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/85 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {roleLabel}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown on notices under the signature block. Update when the officer changes.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`issuer-name-${issuer.id}`}>Display name</Label>
        <Input
          id={`issuer-name-${issuer.id}`}
          value={draft.name}
          onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
          placeholder="e.g. Fr. John Doe SDB"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`issuer-desig-${issuer.id}`}>Designation</Label>
        <Input
          id={`issuer-desig-${issuer.id}`}
          value={draft.designation}
          onChange={(e) => onDraftChange({ ...draft, designation: e.target.value })}
          placeholder="e.g. Principal cum Secretary"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`issuer-phone-${issuer.id}`}>Mobile (letterhead)</Label>
          <Input
            id={`issuer-phone-${issuer.id}`}
            value={draft.phone}
            onChange={(e) => onDraftChange({ ...draft, phone: e.target.value })}
            placeholder="+91 94021 52496"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`issuer-email-${issuer.id}`}>Email (letterhead)</Label>
          <Input
            id={`issuer-email-${issuer.id}`}
            type="email"
            value={draft.email}
            onChange={(e) => onDraftChange({ ...draft, email: e.target.value })}
            placeholder="principaldbct@gmail.com"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        When this officer issues a notice, the PDF header shows their mobile and email.
      </p>

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

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={savePending || !draft.name.trim()}
          onClick={onSave}
        >
          <Save className="mr-2 h-4 w-4" />
          Save issuer
        </Button>
        {saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
      </div>
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
