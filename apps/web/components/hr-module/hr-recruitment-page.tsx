'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createRecruitmentApplication,
  createRecruitmentVacancy,
  fetchRecruitmentApplications,
  fetchRecruitmentStats,
  fetchRecruitmentVacancies,
  scheduleRecruitmentInterview,
  updateRecruitmentApplicationStatus,
} from '@/services/hr';
import { apiErrorMessage } from '@/utils/api-error';

export function HrRecruitmentPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [vacancyForm, setVacancyForm] = useState({
    title: '',
    staffType: 'TEACHING',
    vacanciesCount: 1,
    description: '',
  });

  const statsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'stats'],
    queryFn: fetchRecruitmentStats,
    enabled,
  });
  const vacanciesQ = useQuery({
    queryKey: ['hr', 'recruitment', 'vacancies'],
    queryFn: () => fetchRecruitmentVacancies(),
    enabled,
  });
  const appsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'applications'],
    queryFn: () => fetchRecruitmentApplications(),
    enabled,
  });

  const createVacancyMut = useMutation({
    mutationFn: () => createRecruitmentVacancy(vacancyForm),
    onSuccess: () => {
      setMessage('Vacancy created.');
      void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create vacancy')),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) =>
      import('@/services/api').then(({ api }) =>
        api.patch(`/v1/hr/recruitment/vacancies/${id}/status`, { status: 'PUBLISHED' }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateRecruitmentApplicationStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] }),
  });

  const stats = statsQ.data;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Recruitment</h2>
        <p className="text-sm text-muted-foreground">
          Vacancies, applications, interviews, and offer letters.
        </p>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ['Open Vacancies', stats?.openVacancies ?? '—'],
          ['Applications', stats?.submitted ?? '—'],
          ['Shortlisted', stats?.shortlisted ?? '—'],
          ['Interviews', stats?.interviews ?? '—'],
          ['Offers', stats?.offers ?? '—'],
          ['Hired', stats?.hired ?? '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/60 bg-card px-3 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3 p-4">
          <h3 className="font-semibold">Create Vacancy</h3>
          <Input
            placeholder="Job title"
            value={vacancyForm.title}
            onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })}
          />
          <select
            className="w-full rounded-md border px-2 py-2 text-sm"
            value={vacancyForm.staffType}
            onChange={(e) => setVacancyForm({ ...vacancyForm, staffType: e.target.value })}
          >
            <option value="TEACHING">Teaching</option>
            <option value="NON_TEACHING">Non-Teaching</option>
            <option value="CONTRACT">Contract</option>
          </select>
          <Input
            type="number"
            placeholder="Positions"
            value={vacancyForm.vacanciesCount}
            onChange={(e) =>
              setVacancyForm({ ...vacancyForm, vacanciesCount: Number(e.target.value) })
            }
          />
          <Input
            placeholder="Description"
            value={vacancyForm.description}
            onChange={(e) => setVacancyForm({ ...vacancyForm, description: e.target.value })}
          />
          <Button
            disabled={!vacancyForm.title || createVacancyMut.isPending}
            onClick={() => createVacancyMut.mutate()}
          >
            Save Vacancy
          </Button>
        </GlassCard>

        <GlassCard className="p-4">
          <h3 className="mb-3 font-semibold">Vacancies</h3>
          <ul className="space-y-2 text-sm">
            {(vacanciesQ.data ?? []).map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded border px-3 py-2">
                <div>
                  <p className="font-medium">{v.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.status} · {v.vacanciesCount} positions
                  </p>
                </div>
                {v.status === 'DRAFT' ? (
                  <Button size="sm" variant="outline" onClick={() => publishMut.mutate(v.id)}>
                    Publish
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <GlassCard className="p-4">
        <h3 className="mb-3 font-semibold">Candidate Pipeline</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Candidate</th>
              <th>Vacancy</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(appsQ.data ?? []).map((a) => (
              <tr key={a.id} className="border-b border-border/60">
                <td className="py-2">
                  {a.fullName}
                  <br />
                  <span className="text-xs text-muted-foreground">{a.email ?? a.mobile}</span>
                </td>
                <td className="py-2">{a.vacancy?.title}</td>
                <td className="py-2">{a.status}</td>
                <td className="py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => statusMut.mutate({ id: a.id, status: 'SHORTLISTED' })}
                    >
                      Shortlist
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        scheduleRecruitmentInterview({
                          applicationId: a.id,
                          scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
                        })
                      }
                    >
                      Interview
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => statusMut.mutate({ id: a.id, status: 'REJECTED' })}
                    >
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          After offer acceptance, create staff from{' '}
          <Link href="/admin/staff/new" className="text-primary underline">
            Add Staff
          </Link>
          .
        </p>
      </GlassCard>
    </div>
  );
}
