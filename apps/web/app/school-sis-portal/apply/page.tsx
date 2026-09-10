'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isSecondarySchoolSisSession } from '@/lib/school-erp/product';
import { isSchoolWebPublicHost } from '@/lib/school-web/hosts';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { publicClient } from '@/lib/http/public-client';
import { apiErrorMessage } from '@/utils/api-error';

type Cycle = { id: string; name: string; closesAt: string };

export default function SchoolSisPublicApplyPage({ embedded = false }: { embedded?: boolean }) {
  const allowed =
    typeof window === 'undefined'
      ? true
      : isSecondarySchoolSisSession({ hostname: window.location.hostname }) ||
        isSchoolWebPublicHost(window.location.hostname);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cycleId: '',
    fullName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    previousSchoolName: '',
    previousClass: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
  });

  const cycles = useQuery({
    queryKey: ['school-sis-public-cycles'],
    queryFn: async () => {
      const { data } = await publicClient.get<Cycle[]>('/v1/school-sis/public/cycles', {
        headers: getLoginRequestHeaders(),
      });
      return data;
    },
    enabled: allowed,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data } = await publicClient.post<{ applicationNumber: string }>(
        '/v1/school-sis/public/applications',
        form,
        { headers: getLoginRequestHeaders() },
      );
      return data;
    },
    onSuccess: (data) => {
      setError(null);
      setMessage(`Application submitted. Your number is ${data.applicationNumber}.`);
    },
    onError: (err) => {
      setMessage(null);
      setError(apiErrorMessage(err));
    },
  });

  if (!allowed) {
    return (
      <p className="p-6 text-sm text-slate-600">
        This application form is only for St. Luke’s Secondary School ERP hosts.
      </p>
    );
  }

  return (
    <div className={embedded ? 'sls-apply-form' : 'mx-auto max-w-lg px-4 py-10'}>
      {embedded ? null : (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a572]">
            St. Luke’s Secondary School, Tura
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1a365d]">Online admission</h1>
        </>
      )}
      <p className="mt-2 text-sm text-slate-600">
        Submit an application for the current cycle. The office will review it and create a student
        record with a permanent admission number if you are offered a seat.
      </p>
      {cycles.isError ? (
        <p className="mt-4 text-sm text-red-600">{apiErrorMessage(cycles.error)}</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <div>
          <Label>Admission cycle</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border px-3"
            required
            value={form.cycleId}
            onChange={(e) => setForm((f) => ({ ...f, cycleId: e.target.value }))}
          >
            <option value="">Select</option>
            {(cycles.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Student full name</Label>
          <Input
            className="mt-1"
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Date of birth</Label>
            <Input
              className="mt-1"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            />
          </div>
          <div>
            <Label>Gender</Label>
            <Input
              className="mt-1"
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            className="mt-1"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Previous school</Label>
            <Input
              className="mt-1"
              value={form.previousSchoolName}
              onChange={(e) => setForm((f) => ({ ...f, previousSchoolName: e.target.value }))}
            />
          </div>
          <div>
            <Label>Last class</Label>
            <Input
              className="mt-1"
              value={form.previousClass}
              onChange={(e) => setForm((f) => ({ ...f, previousClass: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Guardian name</Label>
          <Input
            className="mt-1"
            required
            value={form.guardianName}
            onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Guardian phone</Label>
            <Input
              className="mt-1"
              value={form.guardianPhone}
              onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
            />
          </div>
          <div>
            <Label>Guardian email</Label>
            <Input
              className="mt-1"
              type="email"
              value={form.guardianEmail}
              onChange={(e) => setForm((f) => ({ ...f, guardianEmail: e.target.value }))}
            />
          </div>
        </div>
        <Button type="submit" disabled={submit.isPending || !form.cycleId}>
          Submit application
        </Button>
      </form>
    </div>
  );
}
