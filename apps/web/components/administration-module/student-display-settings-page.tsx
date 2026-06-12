'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { formatStudentDisplayName } from '@/utils/student-name-format';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchStudentDisplaySettings,
  updateStudentDisplaySettings,
} from '@/services/student-display-settings';
import {
  STUDENT_NAME_DISPLAY_FORMAT_LABELS,
  type StudentNameDisplayFormat,
} from '@/utils/student-name-format';

const PREVIEW_NAME = 'Gracy Marak';

export function StudentDisplaySettingsPage() {
  useRequireAuth();
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ['settings', 'student-display'],
    queryFn: fetchStudentDisplaySettings,
  });

  const [nameDisplayFormat, setNameDisplayFormat] = useState<StudentNameDisplayFormat>('UPPERCASE');

  useEffect(() => {
    if (settingsQ.data?.nameDisplayFormat) {
      setNameDisplayFormat(settingsQ.data.nameDisplayFormat);
    }
  }, [settingsQ.data?.nameDisplayFormat]);

  const saveMut = useMutation({
    mutationFn: updateStudentDisplaySettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings', 'student-display'] });
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  return (
    <DashboardShell role="admin" title="Student Display Settings">
      <AdminShell>
        <AdminPageHeader
          title="Student Display Settings"
          subtitle="Control how student names appear across the ERP while preserving the original stored value."
        />

        <AdminGlassCard className="max-w-2xl space-y-5 p-5">
          <div>
            <p className="text-sm font-medium">Display name format</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Names are stored exactly as entered during admission or import. This setting only
              affects display in directories, profiles, reports, certificates, and exports.
            </p>
          </div>

          <fieldset className="space-y-2">
            {(Object.keys(STUDENT_NAME_DISPLAY_FORMAT_LABELS) as StudentNameDisplayFormat[]).map(
              (option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="nameDisplayFormat"
                    checked={nameDisplayFormat === option}
                    onChange={() => setNameDisplayFormat(option)}
                  />
                  {STUDENT_NAME_DISPLAY_FORMAT_LABELS[option]}
                </label>
              ),
            )}
          </fieldset>

          <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Preview</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Stored: <span className="font-mono">{PREVIEW_NAME}</span>
            </p>
            <p className="mt-2 text-lg font-semibold tracking-wide">
              {formatStudentDisplayName(PREVIEW_NAME, nameDisplayFormat)}
            </p>
          </div>

          <Button
            disabled={saveMut.isPending || settingsQ.isLoading}
            onClick={() => saveMut.mutate({ nameDisplayFormat })}
          >
            {saveMut.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </AdminGlassCard>
      </AdminShell>
    </DashboardShell>
  );
}
