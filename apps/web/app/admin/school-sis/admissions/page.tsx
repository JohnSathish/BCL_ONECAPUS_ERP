'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function SchoolSisAdmissionsPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState('Admission window');
  const [sectionByApp, setSectionByApp] = useState<Record<string, string>>({});
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Online admission</h1>
        <p className="text-sm text-slate-500">
          Public form: /school-sis-portal/apply on this school host. Convert offered applications
          into a student master and this year’s enrollment.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form
        className="flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          createCycle.mutate();
        }}
      >
        <div>
          <Label>New cycle name</Label>
          <Input
            className="mt-1"
            value={cycleName}
            onChange={(e) => setCycleName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={createCycle.isPending}>
          Open cycle
        </Button>
      </form>

      <div className="rounded-2xl border bg-white p-4 text-sm">
        <h2 className="font-medium">Cycles</h2>
        <ul className="mt-2 space-y-1">
          {(cycles.data ?? []).map((c) => (
            <li key={c.id}>
              {c.name} · {c.status} · {new Date(c.opensAt).toLocaleDateString()}–
              {new Date(c.closesAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-2">No.</th>
              <th className="px-4 py-2">Applicant</th>
              <th className="px-4 py-2">Guardian</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(applications.data ?? []).map((app) => (
              <tr key={app.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{app.applicationNumber}</td>
                <td className="px-4 py-2">{app.fullName}</td>
                <td className="px-4 py-2">
                  {app.guardianName}
                  {app.guardianPhone ? ` · ${app.guardianPhone}` : ''}
                </td>
                <td className="px-4 py-2">{app.status}</td>
                <td className="px-4 py-2">
                  {app.status === 'ENROLLED' ? (
                    <span>Admitted {app.student?.admissionNumber}</span>
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
                          {st}
                        </Button>
                      ))}
                      <select
                        className="h-8 rounded border px-2"
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
