'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { CareersPublicShell } from '@/components/careers-portal/careers-public-shell';
import { CareersStatusTracker } from '@/components/careers-portal/careers-status-tracker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchCareersApplicationStatus, uploadCareersDocument } from '@/services/careers-portal';
import { apiErrorMessage } from '@/utils/api-error';

export default function CareersApplicationStatusPage() {
  const search = useSearchParams();
  const [applicationNo, setApplicationNo] = useState(search.get('no') ?? '');
  const [mobile, setMobile] = useState(search.get('mobile') ?? '');
  const [justSubmitted] = useState(search.get('submitted') === '1');

  const statusMut = useMutation({
    mutationFn: () => fetchCareersApplicationStatus(applicationNo.trim(), mobile.trim()),
  });

  const uploadMut = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: 'resume' | 'photo' | 'certificate' }) =>
      uploadCareersDocument(applicationNo.trim(), mobile.trim(), kind, file),
    onSuccess: () => statusMut.mutate(),
  });

  useEffect(() => {
    if (applicationNo.trim() && mobile.trim() && (justSubmitted || search.get('no'))) {
      statusMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = statusMut.data;

  return (
    <CareersPublicShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Track Your Application</h1>
        <p className="mt-2 text-slate-400">
          Enter your application number and registered mobile number
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-xl sm:p-8">
          <div className="space-y-4">
            <div>
              <Label>Application Number</Label>
              <Input
                placeholder="DBC-APP-2026-00125"
                value={applicationNo}
                onChange={(e) => setApplicationNo(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <Button
              className="w-full bg-[#1e3a5f] hover:bg-[#152a45]"
              onClick={() => statusMut.mutate()}
              disabled={!applicationNo.trim() || !mobile.trim() || statusMut.isPending}
            >
              Check Status
            </Button>
          </div>

          {statusMut.isError ? (
            <p className="mt-4 text-sm text-red-600">
              {apiErrorMessage(statusMut.error, 'Application not found')}
            </p>
          ) : null}

          {justSubmitted && result ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Application submitted successfully!</p>
                <p className="mt-1 font-mono text-sm">{result.applicationNo}</p>
                <p className="mt-2 text-sm">
                  Confirmation has been sent to your email and WhatsApp (if configured).
                </p>
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="mt-8 space-y-6 border-t pt-8">
              <div>
                <p className="text-lg font-semibold text-[#1e3a5f]">{result.fullName}</p>
                <p className="font-mono text-sm text-slate-500">{result.applicationNo}</p>
                {result.vacancy ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {result.vacancy.title}
                    {result.vacancy.department?.name ? ` · ${result.vacancy.department.name}` : ''}
                  </p>
                ) : null}
              </div>

              <CareersStatusTracker timeline={result.timeline} />

              {result.interview ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Interview scheduled</p>
                  <p className="mt-1">
                    {new Date(result.interview.scheduledAt).toLocaleString('en-IN')}
                    {result.interview.venue ? ` @ ${result.interview.venue}` : ''}
                  </p>
                </div>
              ) : null}

              {result.canUploadDocuments ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4">
                  <p className="font-medium">Upload pending documents</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Resume: {result.resumeUploaded ? '✓' : 'pending'} · Certificates:{' '}
                    {result.certificatesCount ?? 0}
                  </p>
                  <Input
                    type="file"
                    accept=".pdf,image/*"
                    className="mt-3"
                    disabled={uploadMut.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMut.mutate({ file, kind: 'certificate' });
                      e.target.value = '';
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </CareersPublicShell>
  );
}
