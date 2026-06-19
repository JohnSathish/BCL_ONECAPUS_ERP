'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { Button } from '@/components/ui/button';
import { AssignReplacementDialog } from '@/components/hr-module/substitute/assign-replacement-dialog';
import { fetchActiveReplacementForStaff } from '@/services/hr-substitute';
import { SALARY_ARRANGEMENT_OPTIONS } from '@/services/hr-substitute';
import type { StaffProfile } from '@/types/staff';
import { formatDisplayDate } from '@/utils/format-date';

export function StaffSpecialAssignmentSection({
  profile,
  canEdit,
}: {
  profile: StaffProfile;
  canEdit: boolean;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const assignment = useQuery({
    queryKey: ['hr', 'substitute', 'active', profile.id],
    queryFn: () => fetchActiveReplacementForStaff(profile.id),
  });

  const active = assignment.data;
  const onLeave = profile.status === 'ON_LEAVE';

  return (
    <SectionCard
      title="Special Assignment"
      description="Study leave, sabbatical, and replacement faculty coverage"
      footer={
        canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            Assign Replacement Faculty
          </Button>
        ) : null
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Current Status</dt>
          <dd className="font-medium">
            {active ? active.reasonLabel : onLeave ? 'On Leave' : 'Active'}
          </dd>
        </div>
        {active ? (
          <>
            <div>
              <dt className="text-muted-foreground">Assignment Status</dt>
              <dd className="font-medium">{active.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Period</dt>
              <dd className="font-medium">
                {formatDisplayDate(active.startDate)} – {formatDisplayDate(active.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Replacement Staff</dt>
              <dd className="font-medium">{active.substitute.fullName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Salary Arrangement</dt>
              <dd className="font-medium">
                {SALARY_ARRANGEMENT_OPTIONS.find((o) => o.value === active.salaryArrangement)
                  ?.label ?? active.salaryArrangement}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Subjects Covered</dt>
              <dd className="font-medium">
                {active.fullWorkloadTransfer
                  ? 'Full workload transfer'
                  : active.subjects
                      .map((s) => s.subjectLabel)
                      .filter(Boolean)
                      .join(', ') || '—'}
              </dd>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2 text-muted-foreground">
            No active replacement assignment. Faculty is teaching under their own profile.
          </div>
        )}
      </dl>

      <AssignReplacementDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        originalStaffProfileId={profile.id}
        originalStaffName={profile.fullName}
        onSuccess={() => assignment.refetch()}
      />
    </SectionCard>
  );
}
