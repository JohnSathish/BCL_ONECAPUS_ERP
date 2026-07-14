'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { api } from '@/services/api';
import { apiErrorMessage } from '@/utils/api-error';

type Ward = {
  id?: string;
  studentId?: string;
  fullName?: string;
  name?: string;
  programme?: string;
  rollNumber?: string;
  relationship?: string;
};

function unwrapWards(data: unknown): Ward[] {
  if (Array.isArray(data)) return data as Ward[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['wards', 'items', 'data', 'links']) {
      if (Array.isArray(obj[key])) return obj[key] as Ward[];
    }
  }
  return [];
}

export function ParentWardsPortal() {
  const enabled = useAuthQueryEnabled();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const wardsQ = useQuery({
    queryKey: ['parent-portal', 'wards'],
    queryFn: async () => {
      const { data } = await api.get('/v1/parent-portal/wards');
      return unwrapWards(data);
    },
    enabled,
    retry: 1,
  });

  const wardId = selectedId ?? wardsQ.data?.[0]?.studentId ?? wardsQ.data?.[0]?.id ?? null;

  const attendanceQ = useQuery({
    queryKey: ['parent-portal', 'attendance', wardId],
    queryFn: async () => {
      const { data } = await api.get(`/v1/parent-portal/wards/${wardId}/attendance`);
      return data as { summary?: string; percent?: number; recent?: unknown[] };
    },
    enabled: enabled && Boolean(wardId),
    retry: 1,
  });

  const feesQ = useQuery({
    queryKey: ['parent-portal', 'fees', wardId],
    queryFn: async () => {
      const { data } = await api.get(`/v1/parent-portal/wards/${wardId}/fees`);
      return data as { outstanding?: number; currency?: string; recent?: unknown[] };
    },
    enabled: enabled && Boolean(wardId),
    retry: 1,
  });

  const wards = wardsQ.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">My wards</h2>
        <p className="text-sm text-muted-foreground">
          View linked students, attendance summary, and fee placeholders.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked students</CardTitle>
          <CardDescription>
            {wardsQ.isLoading ? 'Loading…' : `${wards.length} ward(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {wardsQ.isError ? (
            <p className="text-sm text-muted-foreground">
              Unable to load wards ({apiErrorMessage(wardsQ.error)}).
            </p>
          ) : wards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students linked to this parent account.
            </p>
          ) : (
            <ul className="space-y-2">
              {wards.map((ward) => {
                const id = String(ward.studentId ?? ward.id ?? '');
                const active = id === wardId;
                return (
                  <li key={id}>
                    <Button
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedId(id)}
                    >
                      <span className="font-medium">{ward.fullName ?? ward.name ?? id}</span>
                      {ward.rollNumber || ward.programme ? (
                        <span className="ml-2 text-xs opacity-80">
                          {[ward.rollNumber, ward.programme].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance</CardTitle>
            <CardDescription>Placeholder summary from parent-portal API</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {!wardId ? (
              'Select a ward to view attendance.'
            ) : attendanceQ.isLoading ? (
              'Loading…'
            ) : attendanceQ.isError ? (
              apiErrorMessage(attendanceQ.error, 'Attendance unavailable')
            ) : (
              <div className="space-y-1 text-foreground">
                <p>
                  {attendanceQ.data?.summary ??
                    (attendanceQ.data?.percent != null
                      ? `${attendanceQ.data.percent}% attendance`
                      : 'No attendance summary returned yet.')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fees</CardTitle>
            <CardDescription>Placeholder outstanding dues from parent-portal API</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {!wardId ? (
              'Select a ward to view fees.'
            ) : feesQ.isLoading ? (
              'Loading…'
            ) : feesQ.isError ? (
              apiErrorMessage(feesQ.error, 'Fees unavailable')
            ) : (
              <div className="space-y-1 text-foreground">
                <p>
                  {feesQ.data?.outstanding != null
                    ? `Outstanding: ${feesQ.data.currency ?? '₹'}${feesQ.data.outstanding}`
                    : 'No fee summary returned yet.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
