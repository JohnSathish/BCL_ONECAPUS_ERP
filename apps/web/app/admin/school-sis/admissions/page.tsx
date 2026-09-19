'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck, Inbox, Search, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  convertSchoolSisApplication,
  createSchoolSisAdmissionCycle,
  fetchSchoolSisAdmissionCycles,
  fetchSchoolSisApplications,
  fetchSchoolSisMasters,
  patchSchoolSisApplicationStatus,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { SlsKpiCard, SlsPill, SlsToolbar } from '@/components/school-sis/school-sis-saas';

function statusTone(status: string): 'ok' | 'amber' | 'muted' | 'warn' {
  if (status === 'ENROLLED' || status === 'OFFERED') return 'ok';
  if (status === 'REJECTED') return 'warn';
  if (status === 'WAITLIST' || status === 'UNDER_REVIEW') return 'amber';
  return 'muted';
}

export default function SchoolSisAdmissionsPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState('Admission window');
  const [sectionByApp, setSectionByApp] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const cycles = useQuery({
    queryKey: ['school-sis-cycles'],
    queryFn: fetchSchoolSisAdmissionCycles,
    enabled,
  });
  const applications = useQuery({
    queryKey: ['school-sis-applications'],
    queryFn: () => fetchSchoolSisApplications(),
    enabled,
  });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });

  const createCycle = useMutation({
    mutationFn: () =>
      createSchoolSisAdmissionCycle({
        name: cycleName,
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-cycles'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const rows = applications.data ?? [];
  const stats = useMemo(() => {
    return {
      total: rows.length,
      new: rows.filter((a) => a.status === 'SUBMITTED').length,
      offered: rows.filter((a) => a.status === 'OFFERED').length,
      enrolled: rows.filter((a) => a.status === 'ENROLLED').length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((app) => {
      if (status && app.status !== status) return false;
      if (!needle) return true;
      return [app.applicationNumber, app.fullName, app.guardianName, app.guardianPhone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, status]);

  return (
    <div className="sls-page space-y-5">
      <div className="sls-page-head">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--heading,#1a365d)]">
            Applications
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Public form: /school-sis-portal/apply on this school host. Convert offered applications
            into a student master and this year’s enrollment.
          </p>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="sls-stat-grid is-4">
        <SlsKpiCard
          tone="sky"
          icon={Inbox}
          label="All applications"
          value={stats.total}
          hint="School SIS applications only"
          loading={applications.isLoading}
          onClick={() => setStatus('')}
        />
        <SlsKpiCard
          tone="amber"
          icon={Users}
          label="New"
          value={stats.new}
          hint="Submitted, awaiting review"
          loading={applications.isLoading}
          onClick={() => setStatus('SUBMITTED')}
        />
        <SlsKpiCard
          tone="emerald"
          icon={FileCheck}
          label="Offered"
          value={stats.offered}
          hint="Ready to convert"
          loading={applications.isLoading}
          onClick={() => setStatus('OFFERED')}
        />
        <SlsKpiCard
          tone="violet"
          icon={UserPlus}
          label="Enrolled"
          value={stats.enrolled}
          hint="Converted to student master"
          loading={applications.isLoading}
          onClick={() => setStatus('ENROLLED')}
        />
      </div>

      <form
        className="sls-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          createCycle.mutate();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search applicant, guardian, or application no…"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          {['SUBMITTED', 'UNDER_REVIEW', 'WAITLIST', 'OFFERED', 'REJECTED', 'ENROLLED'].map(
            (st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ),
          )}
        </select>
        <input
          value={cycleName}
          onChange={(e) => setCycleName(e.target.value)}
          placeholder="New cycle name"
          aria-label="New cycle name"
        />
        <button type="submit" className="sls-cta" disabled={createCycle.isPending}>
          Open cycle
        </button>
      </form>

      {(cycles.data ?? []).length ? (
        <p className="text-xs text-slate-500">
          {(cycles.data ?? [])
            .map(
              (c) =>
                `${c.name} · ${c.status} · ${new Date(c.opensAt).toLocaleDateString()}–${new Date(c.closesAt).toLocaleDateString()}`,
            )
            .join('  ·  ')}
        </p>
      ) : null}

      <div className="sls-saas-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Guardian</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.id}>
                <td className="px-4 py-3 font-mono text-xs">{app.applicationNumber}</td>
                <td className="px-4 py-3 font-semibold text-[var(--heading,#1a365d)]">
                  {app.fullName}
                </td>
                <td className="px-4 py-3">
                  {app.guardianName}
                  {app.guardianPhone ? ` · ${app.guardianPhone}` : ''}
                </td>
                <td className="px-4 py-3">
                  <SlsPill tone={statusTone(app.status)}>{app.status.replace(/_/g, ' ')}</SlsPill>
                </td>
                <td className="px-4 py-3">
                  {app.status === 'ENROLLED' ? (
                    <span className="text-slate-500">Admitted {app.student?.admissionNumber}</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {['UNDER_REVIEW', 'OFFERED', 'WAITLIST', 'REJECTED'].map((st) => (
                        <Button
                          key={st}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            patchSchoolSisApplicationStatus(app.id, st)
                              .then(() =>
                                qc.invalidateQueries({ queryKey: ['school-sis-applications'] }),
                              )
                              .catch((err) => setError(apiErrorMessage(err)))
                          }
                        >
                          {st.replace(/_/g, ' ')}
                        </Button>
                      ))}
                      <select
                        className="h-8 rounded-lg px-2"
                        value={sectionByApp[app.id] ?? ''}
                        onChange={(e) =>
                          setSectionByApp((m) => ({ ...m, [app.id]: e.target.value }))
                        }
                      >
                        <option value="">Section</option>
                        {(masters.data?.sections ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.grade.name} {s.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!sectionByApp[app.id]}
                        onClick={() =>
                          convertSchoolSisApplication(app.id, { sectionId: sectionByApp[app.id]! })
                            .then(() => {
                              void qc.invalidateQueries({ queryKey: ['school-sis-applications'] });
                              void qc.invalidateQueries({ queryKey: ['school-sis-overview'] });
                            })
                            .catch((err) => setError(apiErrorMessage(err)))
                        }
                      >
                        Convert
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
