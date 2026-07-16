'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import {
  approveProof,
  fetchMySubmission,
  submitMySubmission,
  uploadMySubmissionFile,
} from '@/services/journals-portal';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!session?.accessToken) router.replace('/journals-portal/login');
  }, [session, router]);

  const subQ = useQuery({
    queryKey: ['journal-my-submission', params.id],
    queryFn: () => fetchMySubmission(params.id),
    enabled: Boolean(session?.accessToken && params.id),
  });

  const submit = useMutation({
    mutationFn: () => submitMySubmission(params.id),
    onSuccess: () => {
      setMsg('Submitted to editorial office.');
      void qc.invalidateQueries({ queryKey: ['journal-my-submission', params.id] });
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Submit failed')),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Select a file');
      const kind = subQ.data?.status === 'REVISION_REQUIRED' ? 'REVISION' : 'MANUSCRIPT';
      return uploadMySubmissionFile(params.id, file, kind);
    },
    onSuccess: () => {
      setMsg('File uploaded.');
      setFile(null);
      void qc.invalidateQueries({ queryKey: ['journal-my-submission', params.id] });
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Upload failed')),
  });

  const proof = useMutation({
    mutationFn: () => approveProof(params.id),
    onSuccess: () => {
      setMsg('Proof approved — moved to READY_TO_PUBLISH.');
      void qc.invalidateQueries({ queryKey: ['journal-my-submission', params.id] });
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Proof approval failed')),
  });

  const s = subQ.data;
  const proofs = (s?.files ?? []).filter((f) => f.kind === 'PROOF' || f.kind === 'GALLEY');

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {subQ.isLoading ? (
          <p className="text-sm text-[#0A2342]/60">Loading…</p>
        ) : !s ? (
          <p className="text-sm text-red-700">Submission not found.</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">
              {s.status}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">{s.title}</h1>
            {s.abstract ? <p className="mt-4 text-sm text-[#0A2342]/75">{s.abstract}</p> : null}

            {['COPYEDITING', 'PROOFING', 'READY_TO_PUBLISH'].includes(s.status) ? (
              <p className="mt-4 rounded-md border border-[#F4B400]/40 bg-[#F4B400]/10 px-3 py-2 text-sm">
                In production: {s.status}
                {s.status === 'PROOFING' ? ' — review proofs and approve when ready.' : ''}
              </p>
            ) : null}

            <h2 className="mt-8 font-serif text-xl font-semibold text-[#0A2342]">Files</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {s.files.map((f) => (
                <li key={f.id}>
                  {f.kind} v{f.version}: {f.fileName}
                </li>
              ))}
            </ul>

            {s.status === 'PROOFING' ? (
              <div className="mt-6 space-y-2 rounded-lg border border-[#0A2342]/10 p-4">
                <p className="text-sm text-[#0A2342]/70">
                  Proof files:{' '}
                  {proofs.length
                    ? proofs.map((p) => p.fileName).join(', ')
                    : 'awaiting editor upload'}
                </p>
                <Button disabled={proof.isPending} onClick={() => proof.mutate()}>
                  Approve proof
                </Button>
              </div>
            ) : null}

            {['DRAFT', 'REVISION_REQUIRED'].includes(s.status) ? (
              <div className="mt-6 space-y-3 rounded-lg border border-[#0A2342]/10 p-4">
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
                    Upload {s.status === 'REVISION_REQUIRED' ? 'revision' : 'manuscript'}
                  </Button>
                  <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
                    {s.status === 'REVISION_REQUIRED' ? 'Resubmit' : 'Submit'}
                  </Button>
                </div>
              </div>
            ) : null}

            {s.decisions?.length ? (
              <div className="mt-8">
                <h2 className="font-serif text-xl font-semibold text-[#0A2342]">Decisions</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {s.decisions.map((d) => (
                    <li key={d.id} className="rounded border border-[#0A2342]/10 p-3">
                      <strong>{d.decision}</strong>
                      {d.notesHtml ? (
                        <div className="mt-1" dangerouslySetInnerHTML={{ __html: d.notesHtml }} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {msg ? <p className="mt-4 text-sm text-emerald-800">{msg}</p> : null}
          </>
        )}
      </div>
    </JournalPublicShell>
  );
}
