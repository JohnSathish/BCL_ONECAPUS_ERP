'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchOfficialDocumentIssuers,
  updateOfficialDocumentIssuer,
} from '@/services/official-documents';
import { apiErrorMessage } from '@/utils/api-error';

export function IssuerSignatureStudio() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { signaturePath: string; sealPath: string }>>(
    {},
  );

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
          Set image paths for each issuer (e.g. /uploads/tenants/.../signature.png). Applied
          automatically on PDF generation.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(issuers.data ?? []).map((issuer) => {
          const draft = drafts[issuer.id] ?? {
            signaturePath: issuer.signaturePath ?? '',
            sealPath: issuer.sealPath ?? '',
          };
          return (
            <div
              key={issuer.id}
              className="space-y-3 rounded-2xl border border-border/60 bg-card/85 p-4"
            >
              <div>
                <p className="font-semibold">{issuer.name}</p>
                <p className="text-xs text-muted-foreground">{issuer.designation}</p>
              </div>
              <label className="block text-xs font-medium">
                Signature image path
                <input
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-mono"
                  value={draft.signaturePath}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [issuer.id]: { ...draft, signaturePath: e.target.value },
                    }))
                  }
                />
              </label>
              {draft.signaturePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.signaturePath} alt="Signature preview" className="max-h-16" />
              ) : null}
              <label className="block text-xs font-medium">
                Seal image path
                <input
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-mono"
                  value={draft.sealPath}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [issuer.id]: { ...draft, sealPath: e.target.value },
                    }))
                  }
                />
              </label>
              {draft.sealPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.sealPath} alt="Seal preview" className="max-h-16" />
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={updateMut.isPending}
                onClick={() =>
                  updateMut.mutate({
                    id: issuer.id,
                    payload: {
                      signaturePath: draft.signaturePath || undefined,
                      sealPath: draft.sealPath || undefined,
                    },
                  })
                }
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
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
