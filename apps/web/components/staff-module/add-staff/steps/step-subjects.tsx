'use client';

import { Trash2 } from 'lucide-react';

import { ErpFormSection } from '@/components/erp/erp-workspace-shell';
import { TeachingAssignmentPicker } from '@/components/staff-module/teaching-assignment-picker';
import type { TeachingAssignmentContext } from '@/types/staff';
import type { AddStaffDraft } from '@/components/staff-module/add-staff/types/draft';
import { Button } from '@/components/ui/button';

type Props = {
  draft: AddStaffDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStaffDraft>>;
};

export function StepSubjects({ draft, setDraft }: Props) {
  const isTeaching = draft.staffType === 'TEACHING';

  const addAssignments = (selections: TeachingAssignmentContext[]) => {
    setDraft((d) => ({
      ...d,
      subjectAssignments: [
        ...d.subjectAssignments,
        ...selections
          .filter(
            (selection) =>
              !d.subjectAssignments.some(
                (a) => a.offeringSectionId === selection.offeringSectionId,
              ),
          )
          .map((selection) => ({
            courseId: selection.courseId,
            courseLabel: `${selection.course.code} — ${selection.course.title}`,
            offeringSectionId: selection.offeringSectionId,
            programVersionId: selection.programVersionId,
            semesterNo: selection.semesterNo,
            category: selection.category,
            shiftId: selection.shiftId,
          })),
      ],
    }));
  };

  const removeAssignment = (index: number) => {
    setDraft((d) => ({
      ...d,
      subjectAssignments: d.subjectAssignments.filter((_, i) => i !== index),
    }));
  };

  if (!isTeaching) {
    return (
      <ErpFormSection
        title="Subject assignments"
        description="Not applicable for non-teaching staff"
      >
        <p className="text-xs text-muted-foreground">
          Subject assignments are only required for teaching staff. You can skip this step.
        </p>
      </ErpFormSection>
    );
  }

  return (
    <div className="space-y-3">
      <ErpFormSection
        title="Teaching subjects"
        description="Initial subject assignments (optional)"
      >
        <TeachingAssignmentPicker
          defaultDepartmentId={draft.departmentId}
          assignedContextIds={draft.subjectAssignments.flatMap((a) =>
            a.offeringSectionId ? [a.offeringSectionId] : [],
          )}
          recentStorageKey="onecampus.staff.add.recent-courses"
          confirmLabel="Add selected"
          onConfirm={addAssignments}
        />
      </ErpFormSection>

      {draft.subjectAssignments.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border/60 text-xs">
          {draft.subjectAssignments.map((a, i) => (
            <li
              key={`${a.courseId}-${i}`}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span>
                {a.courseLabel} · Sem {a.semesterNo}
                {a.category ? ` · ${a.category}` : ''}
                {a.offeringSectionId ? ' · Context ready' : ' · Needs context'}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => removeAssignment(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No subject assignments yet — you can add them after creation.
        </p>
      )}
    </div>
  );
}
