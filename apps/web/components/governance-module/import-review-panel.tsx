'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  commitGovernanceImportDraft,
  downloadGovernanceImportTemplate,
  fetchGovernanceImportDrafts,
  rejectGovernanceImportDraft,
  updateGovernanceImportDraft,
  uploadGovernanceExcelImport,
  uploadGovernancePdfImport,
} from '@/services/governance';
import type {
  GovernanceImportDraft,
  GovernanceImportDraftMember,
  GovernanceImportDraftParsed,
} from '@/types/governance';
import { apiErrorMessage } from '@/utils/api-error';
import { StaffMemberPicker } from '@/components/governance-module/staff-member-picker';
import axios from 'axios';

function governanceImportErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    const raw = typeof error.response.data === 'string' ? error.response.data : '';
    if (/governance\/imports/i.test(raw) || /Cannot (GET|POST).*governance/i.test(raw)) {
      return 'Governance import API is not available. Restart the dev server (npm run dev) so the API reloads CGMS routes, then hard-refresh this page (Ctrl+Shift+R).';
    }
  }
  return apiErrorMessage(error, fallback);
}

function confidenceTone(score: number) {
  if (score >= 0.8) return 'bg-emerald-100 text-emerald-800';
  if (score >= 0.5) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

function staffMatchLabel(member: GovernanceImportDraftMember) {
  if (member.isExternal) return 'External';
  if (member.staffProfileId) {
    const pct = member.staffMatchConfidence ? Math.round(member.staffMatchConfidence * 100) : 100;
    return `Staff linked (${pct}%)`;
  }
  return 'No staff match';
}

function DraftEditor({
  draft,
  onSaved,
}: {
  draft: GovernanceImportDraft;
  onSaved: (message: string) => void;
}) {
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<GovernanceImportDraftParsed>(draft.parsedJson);

  const saveMut = useMutation({
    mutationFn: () => updateGovernanceImportDraft(draft.id, { parsedJson: parsed }),
    onSuccess: () => {
      onSaved('Draft saved.');
      void qc.invalidateQueries({ queryKey: ['governance', 'import'] });
    },
    onError: (e) => onSaved(governanceImportErrorMessage(e, 'Unable to save draft.')),
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      await updateGovernanceImportDraft(draft.id, { parsedJson: parsed, reviewStatus: 'APPROVED' });
      return commitGovernanceImportDraft(draft.id);
    },
    onSuccess: () => {
      onSaved(`Committee "${parsed.name}" created.`);
      void qc.invalidateQueries({ queryKey: ['governance'] });
    },
    onError: (e) => onSaved(governanceImportErrorMessage(e, 'Unable to commit draft.')),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectGovernanceImportDraft(draft.id),
    onSuccess: () => {
      onSaved('Draft rejected.');
      void qc.invalidateQueries({ queryKey: ['governance', 'import'] });
    },
    onError: (e) => onSaved(governanceImportErrorMessage(e, 'Unable to reject draft.')),
  });

  const updateMember = (index: number, patch: Partial<GovernanceImportDraftMember>) => {
    const members = [...(parsed.members ?? [])];
    members[index] = { ...members[index], ...patch };
    setParsed({ ...parsed, members });
  };

  const addMember = () => {
    setParsed({
      ...parsed,
      members: [...(parsed.members ?? []), { displayName: '', role: 'MEMBER' }],
    });
  };

  if (draft.reviewStatus === 'COMMITTED' || draft.reviewStatus === 'REJECTED') {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        Draft {draft.reviewStatus.toLowerCase()}.
        {draft.committeeId ? ` Committee ID: ${draft.committeeId}` : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold">Parsed preview</p>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Committee name</Label>
            <Input
              value={parsed.name}
              onChange={(e) => setParsed({ ...parsed, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Short code</Label>
            <Input
              value={parsed.shortCode ?? ''}
              onChange={(e) => setParsed({ ...parsed, shortCode: e.target.value })}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Input
              value={parsed.category ?? ''}
              onChange={(e) => setParsed({ ...parsed, category: e.target.value })}
            />
          </div>
          <div>
            <Label>Type</Label>
            <Input
              value={parsed.committeeType ?? 'STANDING'}
              onChange={(e) => setParsed({ ...parsed, committeeType: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={parsed.description ?? ''}
            onChange={(e) => setParsed({ ...parsed, description: e.target.value })}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Members</Label>
            <Button type="button" variant="outline" size="sm" onClick={addMember}>
              Add member
            </Button>
          </div>
          <div className="space-y-2">
            {(parsed.members ?? []).map((member, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs">
                    {staffMatchLabel(member)}
                  </Badge>
                  {member.employeeCode ? (
                    <span className="text-xs text-muted-foreground">
                      Code: {member.employeeCode}
                    </span>
                  ) : null}
                </div>
                <StaffMemberPicker
                  member={member}
                  onChange={(patch) => updateMember(index, patch)}
                />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    placeholder="Staff name"
                    value={member.displayName}
                    onChange={(e) => updateMember(index, { displayName: e.target.value })}
                  />
                  <Input
                    placeholder="Employee code"
                    value={member.employeeCode ?? ''}
                    onChange={(e) =>
                      updateMember(index, {
                        employeeCode: e.target.value,
                        staffProfileId: null,
                        userId: null,
                      })
                    }
                  />
                  <Input
                    placeholder="Role"
                    value={member.role}
                    onChange={(e) => updateMember(index, { role: e.target.value })}
                  />
                  <Input
                    placeholder="Designation"
                    value={member.designation ?? ''}
                    onChange={(e) => updateMember(index, { designation: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    value={member.email ?? ''}
                    onChange={(e) => updateMember(index, { email: e.target.value })}
                  />
                  <Input
                    placeholder="Mobile"
                    value={member.mobile ?? ''}
                    onChange={(e) => updateMember(index, { mobile: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save draft
          </Button>
          <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
            {commitMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Approve & create
          </Button>
          <Button
            variant="destructive"
            onClick={() => rejectMut.mutate()}
            disabled={rejectMut.isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ImportReviewPanel({ onMessage }: { onMessage?: (msg: string) => void }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const excelRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState('');

  const notify = (msg: string) => {
    setLocalMessage(msg);
    onMessage?.(msg);
  };

  const templateMut = useMutation({
    mutationFn: downloadGovernanceImportTemplate,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'governance-committee-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      notify('Template downloaded.');
    },
    onError: (e) => notify(governanceImportErrorMessage(e, 'Unable to download template.')),
  });

  const excelMut = useMutation({
    mutationFn: (file: File) => uploadGovernanceExcelImport(file),
    onSuccess: (batch) => {
      notify(
        `Excel uploaded — ${batch.drafts?.length ?? 0} committee draft(s) from ${batch.fileName}`,
      );
      setBatchId(batch.id);
      setSelectedDraftId(null);
      void qc.invalidateQueries({ queryKey: ['governance', 'import'] });
    },
    onError: (e) => notify(governanceImportErrorMessage(e, 'Excel upload failed.')),
  });

  const pdfMut = useMutation({
    mutationFn: (file: File) => uploadGovernancePdfImport(file),
    onSuccess: (batch) => {
      notify(
        `PDF uploaded — review drafts from ${batch.fileName} (names may need manual correction).`,
      );
      setBatchId(batch.id);
      setSelectedDraftId(null);
      void qc.invalidateQueries({ queryKey: ['governance', 'import'] });
    },
    onError: (e) => notify(governanceImportErrorMessage(e, 'PDF upload failed.')),
  });

  const draftsQ = useQuery({
    queryKey: ['governance', 'import', batchId, 'drafts'],
    queryFn: () => fetchGovernanceImportDrafts(batchId!),
    enabled: enabled && Boolean(batchId),
  });

  const selectedDraft = draftsQ.data?.find((d) => d.id === selectedDraftId) ?? draftsQ.data?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5" />
          Committee import — Excel (recommended)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download the Excel template, fill committee and member rows (use employee codes for
          reliable staff matching), then upload for review. Use the staff search on each member row
          to link unmatched names. Hard-refresh (Ctrl+Shift+R) if you still see the old PDF-only
          import card.
        </p>
        {localMessage ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            {localMessage}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => templateMut.mutate()}
            disabled={templateMut.isPending}
          >
            {templateMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download template
          </Button>
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) excelMut.mutate(file);
              e.target.value = '';
            }}
          />
          <Button onClick={() => excelRef.current?.click()} disabled={excelMut.isPending}>
            {excelMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload Excel
          </Button>
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pdfMut.mutate(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => pdfRef.current?.click()}
            disabled={pdfMut.isPending}
          >
            <FileUp className="mr-2 h-4 w-4" />
            PDF fallback
          </Button>
          {batchId ? <Badge variant="outline">Batch: {batchId.slice(0, 8)}…</Badge> : null}
        </div>

        {draftsQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading drafts…
          </div>
        ) : null}

        {draftsQ.data?.length ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {draftsQ.data.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => setSelectedDraftId(draft.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    (selectedDraft?.id ?? draftsQ.data?.[0]?.id) === draft.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'bg-background'
                  }`}
                >
                  {draft.parsedJson.name || 'Untitled'}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 ${confidenceTone(draft.confidence)}`}
                  >
                    {Math.round(draft.confidence * 100)}%
                  </span>
                </button>
              ))}
            </div>
            {selectedDraft ? <DraftEditor draft={selectedDraft} onSaved={notify} /> : null}
          </div>
        ) : batchId && !draftsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">No drafts found for this batch yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
