'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { TeachingAssignmentPicker } from '@/components/staff-module/teaching-assignment-picker';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { assignSubject, removeSubjectAssignment } from '@/services/staff';
import type { StaffProfile, TeachingAssignmentContext } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const TEACHING_ROLES = [
  { value: 'PRIMARY_FACULTY', label: 'Primary Faculty' },
  { value: 'CO_FACULTY', label: 'Co-Faculty' },
  { value: 'LAB_INSTRUCTOR', label: 'Lab Instructor' },
  { value: 'PRACTICAL_FACULTY', label: 'Practical Faculty' },
  { value: 'GUEST_FACULTY', label: 'Guest Faculty' },
  { value: 'TUTOR', label: 'Tutor' },
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'EVALUATOR', label: 'Evaluator' },
  { value: 'INTERNSHIP_SUPERVISOR', label: 'Internship Supervisor' },
];

type Props = {
  profile: StaffProfile;
  canAssign: boolean;
  onRefresh: () => void;
};

function assignmentProgramLabel(row: StaffProfile['subjectAssignments'][number]) {
  const version = row.programVersion ?? row.offeringSection?.courseOffering?.programVersion;
  if (!version) return 'Needs repair';
  return `${version.program.code} v${version.version ?? ''}`.trim();
}

function assignmentStreamsLabel(row: StaffProfile['subjectAssignments'][number]) {
  const streams = row.offeringSection?.eligibleStreams ?? [];
  if (!streams.length) return 'All streams';
  return streams.map((s) => s.stream.code).join(', ');
}

function roleLabel(role?: string | null) {
  const match = TEACHING_ROLES.find((item) => item.value === role);
  return match?.label ?? (role ? staffTypeLabel(role) : 'Primary Faculty');
}

export function StaffSubjectsTab({ profile, canAssign, onRefresh }: Props) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('CO_FACULTY');
  const [allocationPercent, setAllocationPercent] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [canMarkAttendance, setCanMarkAttendance] = useState(true);
  const [canEnterInternalMarks, setCanEnterInternalMarks] = useState(false);
  const [canUploadLessonPlan, setCanUploadLessonPlan] = useState(true);
  const [canAccessSubjectWorkspace, setCanAccessSubjectWorkspace] = useState(true);

  const assignMut = useMutation({
    mutationFn: async (selections: TeachingAssignmentContext[]) => {
      for (const selection of selections) {
        const isPrimary = role === 'PRIMARY_FACULTY';
        await assignSubject(profile.id, {
          courseId: selection.courseId,
          semesterNo: selection.semesterNo,
          programVersionId: selection.programVersionId,
          offeringSectionId: selection.offeringSectionId,
          category: selection.category ?? undefined,
          shiftId: selection.shiftId,
          role,
          allocationPercent: allocationPercent ? Number(allocationPercent) : undefined,
          workloadHours: weeklyHours ? Number(weeklyHours) : undefined,
          isPrimaryFaculty: isPrimary,
          canMarkAttendance,
          canEnterInternalMarks,
          canUploadLessonPlan,
          canAccessSubjectWorkspace,
        });
      }
    },
    onSuccess: () => {
      setMessage('');
      onRefresh();
      void qc.invalidateQueries({ queryKey: ['staff', profile.id] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Assignment failed')),
  });

  const removeMut = useMutation({
    mutationFn: (assignmentId: string) => removeSubjectAssignment(profile.id, assignmentId),
    onSuccess: () => {
      onRefresh();
      void qc.invalidateQueries({ queryKey: ['staff', profile.id] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Remove failed')),
  });

  const rows = profile.subjectAssignments ?? [];

  return (
    <SectionCard
      title="Subject assignments"
      description="Courses and semesters assigned to this staff member"
    >
      {canAssign ? (
        <div className="mb-3 flex justify-end">
          <Link
            href={`/admin/staff/assignments?staff=${profile.id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs')}
          >
            Teaching workspace
          </Link>
        </div>
      ) : null}
      {canAssign ? (
        <div className="mb-4 space-y-3">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <label className="space-y-1 text-[11px]">
                <span className="font-medium text-muted-foreground">Teaching role</span>
                <select
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
                  value={role}
                  onChange={(event) => {
                    const nextRole = event.target.value;
                    setRole(nextRole);
                    if (nextRole === 'PRIMARY_FACULTY') setCanEnterInternalMarks(true);
                  }}
                  disabled={assignMut.isPending}
                >
                  {TEACHING_ROLES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-[11px]">
                <span className="font-medium text-muted-foreground">Allocation %</span>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
                  value={allocationPercent}
                  onChange={(event) => setAllocationPercent(event.target.value)}
                  placeholder="e.g. 60"
                  type="number"
                  min="0"
                  max="100"
                  disabled={assignMut.isPending}
                />
              </label>
              <label className="space-y-1 text-[11px]">
                <span className="font-medium text-muted-foreground">Weekly hours</span>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
                  value={weeklyHours}
                  onChange={(event) => setWeeklyHours(event.target.value)}
                  placeholder="e.g. 3"
                  type="number"
                  min="0"
                  step="0.5"
                  disabled={assignMut.isPending}
                />
              </label>
              <PermissionToggle
                label="Attendance"
                checked={canMarkAttendance}
                onChange={setCanMarkAttendance}
              />
              <PermissionToggle
                label="Internal marks"
                checked={canEnterInternalMarks}
                onChange={setCanEnterInternalMarks}
              />
              <PermissionToggle
                label="Lesson plan"
                checked={canUploadLessonPlan}
                onChange={setCanUploadLessonPlan}
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={canAccessSubjectWorkspace}
                onChange={(event) => setCanAccessSubjectWorkspace(event.target.checked)}
                disabled={assignMut.isPending}
              />
              Can access subject workspace
            </label>
          </div>
          <TeachingAssignmentPicker
            staffId={profile.id}
            defaultDepartmentId={profile.departmentId}
            assignedContextIds={rows.flatMap((row) =>
              row.offeringSectionId ? [row.offeringSectionId] : [],
            )}
            disabled={assignMut.isPending}
            recentStorageKey={`onecampus.staff.${profile.id}.recent-courses`}
            confirmLabel="Assign Selected"
            onConfirm={(selections) => assignMut.mutateAsync(selections)}
          />
        </div>
      ) : null}

      {message ? <p className="mb-2 text-xs text-destructive">{message}</p> : null}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No subject assignments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-2">Course</th>
                <th className="py-2 pr-2">Programme Version</th>
                <th className="py-2 pr-2">Sem</th>
                <th className="py-2 pr-2">Section</th>
                <th className="py-2 pr-2">Category</th>
                <th className="py-2 pr-2">Shift</th>
                <th className="py-2 pr-2">Stream Scope</th>
                <th className="py-2 pr-2">Role</th>
                <th className="py-2 pr-2">Load</th>
                <th className="py-2 pr-2">Permissions</th>
                <th className="py-2 pr-2">Status</th>
                {canAssign ? <th className="py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {row.course?.code}
                    </span>{' '}
                    {row.course?.title}
                  </td>
                  <td className="py-2 pr-2">{assignmentProgramLabel(row)}</td>
                  <td className="py-2 pr-2">{row.semesterNo}</td>
                  <td className="py-2 pr-2">
                    {row.offeringSection?.sectionCode ?? 'Needs repair'}
                  </td>
                  <td className="py-2 pr-2">
                    {row.category ? staffTypeLabel(row.category) : 'Needs repair'}
                  </td>
                  <td className="py-2 pr-2">
                    {row.shift?.name ?? row.offeringSection?.shift?.name ?? 'Needs repair'}
                  </td>
                  <td className="py-2 pr-2">{assignmentStreamsLabel(row)}</td>
                  <td className="py-2 pr-2">
                    <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                      {roleLabel(row.teachingRole)}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    {row.allocationPercent != null ? `${row.allocationPercent}%` : '—'}
                    {row.weeklyHours != null ? ` · ${row.weeklyHours} hrs` : ''}
                  </td>
                  <td className="py-2 pr-2">
                    {[
                      row.canMarkAttendance ? 'Attendance' : null,
                      row.canEnterInternalMarks ? 'Marks' : null,
                      row.canUploadLessonPlan ? 'Lesson' : null,
                      row.canAccessSubjectWorkspace ? 'Workspace' : null,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td className="py-2 pr-2">
                    {row.contextStatus === 'LEGACY_UNRESOLVED' ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Needs reassignment
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Context ready
                      </span>
                    )}
                  </td>
                  {canAssign ? (
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={removeMut.isPending}
                        onClick={() => removeMut.mutate(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function PermissionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2 text-[11px] text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
