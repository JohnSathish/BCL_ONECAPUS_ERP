'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchCampuses, fetchInstitutions } from '@/services/organization';
import {
  activateShift,
  assignShiftAdminByEmail,
  createShift,
  deactivateShift,
  fetchShiftAdmins,
  fetchShifts,
  fetchShiftSummary,
  unassignShiftAdmin,
  type ShiftRow,
} from '@/services/shifts';
import { apiErrorMessage } from '@/utils/api-error';

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export default function AdminShiftsPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [campusId, setCampusId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '15:00',
    description: '',
  });
  const [adminShiftId, setAdminShiftId] = useState('');
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    createIfMissing: true,
    isPrimary: true,
  });

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });

  const campuses = useQuery({
    queryKey: ['org', 'campuses'],
    queryFn: () => fetchCampuses(),
    enabled: Boolean(session),
  });

  const shifts = useQuery({
    queryKey: ['shifts', campusId],
    queryFn: () => fetchShifts({ campusId }),
    enabled: Boolean(session) && Boolean(campusId),
  });

  const summary = useQuery({
    queryKey: ['shifts', 'summary', campusId],
    queryFn: () => fetchShiftSummary(campusId),
    enabled: Boolean(session) && Boolean(campusId),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const campus = campuses.data?.find((c) => c.id === campusId);
      if (!campus?.institutionId && !institutionId) {
        throw new Error('Select institution and campus');
      }
      return createShift({
        institutionId: institutionId || campus!.institutionId,
        campusId,
        name: form.name,
        code: form.code,
        startTime: form.startTime,
        endTime: form.endTime,
        sortOrder: shifts.data?.length ?? 0,
      });
    },
    onSuccess: () => {
      setMessage('Shift created.');
      void qc.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Create failed')),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? deactivateShift(id) : activateShift(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const shiftAdmins = useQuery({
    queryKey: ['shifts', 'admins', adminShiftId],
    queryFn: () => fetchShiftAdmins(adminShiftId),
    enabled: Boolean(session) && Boolean(adminShiftId),
  });

  const assignAdminMut = useMutation({
    mutationFn: () =>
      assignShiftAdminByEmail(adminShiftId, {
        email: adminForm.email.trim(),
        isPrimary: adminForm.isPrimary,
        createIfMissing: adminForm.createIfMissing,
        password: adminForm.createIfMissing ? adminForm.password : undefined,
      }),
    onSuccess: () => {
      setMessage('Shift administrator assigned.');
      setAdminForm((f) => ({ ...f, email: '', password: '' }));
      void qc.invalidateQueries({ queryKey: ['shifts', 'admins', adminShiftId] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Assign failed')),
  });

  const unassignAdminMut = useMutation({
    mutationFn: (userId: string) => unassignShiftAdmin(adminShiftId, userId),
    onSuccess: () => {
      setMessage('Removed from shift.');
      void qc.invalidateQueries({ queryKey: ['shifts', 'admins', adminShiftId] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Remove failed')),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Shift management">
      <div className="space-y-6">
        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Campus scope</CardTitle>
            <CardDescription>
              Configure shifts per campus (Morning / Day / Evening or custom)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              Institution
              <select
                className={selectClass}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
              >
                <option value="">Select</option>
                {(institutions.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Campus
              <select
                className={selectClass}
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
              >
                <option value="">Select</option>
                {(campuses.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Shifts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(shifts.data ?? []).map((s: ShiftRow) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                >
                  <span>
                    {s.name} ({s.code}) · {s.startTime}–{s.endTime} · {s.status}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => toggleMut.mutate({ id: s.id, active: s.status === 'ACTIVE' })}
                  >
                    {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add shift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                className={selectClass}
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className={selectClass}
                placeholder="Code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  className={selectClass}
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
                <input
                  type="time"
                  className={selectClass}
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                disabled={!campusId || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                Create shift
              </Button>
            </CardContent>
          </Card>
        </div>

        {campusId ? (
          <Card>
            <CardHeader>
              <CardTitle>Shift administrators</CardTitle>
              <CardDescription>
                Assign users to Morning, Day, Evening, or any shift. They receive the shift-admin
                role and can sign in to the shift portal for that shift only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2 text-sm">
                Shift
                <select
                  className={selectClass}
                  value={adminShiftId}
                  onChange={(e) => setAdminShiftId(e.target.value)}
                >
                  <option value="">Select shift</option>
                  {(shifts.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </label>

              {adminShiftId ? (
                <>
                  <div className="space-y-2">
                    {(shiftAdmins.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No administrators assigned to this shift yet.
                      </p>
                    ) : (
                      (shiftAdmins.data ?? []).map((row) => (
                        <div
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                        >
                          <span>
                            {row.user?.email ?? 'User not found'}
                            {row.isPrimary ? ' · primary' : ''}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={unassignAdminMut.isPending}
                            onClick={() => unassignAdminMut.mutate(row.userId)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm sm:col-span-2">
                      Email
                      <input
                        type="email"
                        className={selectClass}
                        placeholder="e.g. evening.admin@college.edu"
                        value={adminForm.email}
                        onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={adminForm.createIfMissing}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            createIfMissing: e.target.checked,
                          }))
                        }
                      />
                      Create new user if email does not exist
                    </label>
                    {adminForm.createIfMissing ? (
                      <label className="space-y-2 text-sm sm:col-span-2">
                        Password (new users only)
                        <input
                          type="password"
                          className={selectClass}
                          placeholder="Min 8 characters"
                          value={adminForm.password}
                          onChange={(e) =>
                            setAdminForm((f) => ({ ...f, password: e.target.value }))
                          }
                        />
                      </label>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={adminForm.isPrimary}
                        onChange={(e) =>
                          setAdminForm((f) => ({ ...f, isPrimary: e.target.checked }))
                        }
                      />
                      Primary shift for this user
                    </label>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        disabled={
                          !adminForm.email.trim() ||
                          assignAdminMut.isPending ||
                          (adminForm.createIfMissing && adminForm.password.length < 8)
                        }
                        onClick={() => assignAdminMut.mutate()}
                      >
                        Assign shift admin
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {summary.data?.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Cross-shift summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {summary.data.map((row) => (
                  <div key={row.shiftId} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-muted-foreground">
                      {row.students} students · {row.sections} sections
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
