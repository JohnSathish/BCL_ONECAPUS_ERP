'use client';

import { useQuery } from '@tanstack/react-query';
import { Class12SubjectMultiSelect } from '@/components/students-module/class12-subject-multi-select';
import { ErpFormGrid, ErpFormSection } from '@/components/erp/erp-workspace-shell';
import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import {
  GlassField,
  glassInputClass,
  glassSelectClass,
} from '@/components/students-module/add-student/ui/glass-field';
import { fetchBoardNames } from '@/services/support-data';

const BOARD_STREAM_OPTIONS = [
  { value: 'SCIENCE', label: 'Science' },
  { value: 'ARTS', label: 'Arts' },
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'VOCATIONAL', label: 'Vocational' },
] as const;

type Props = {
  draft: AddStudentDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStudentDraft>>;
  errors: Record<string, string>;
};

export function Class12AcademicBackgroundSection({ draft, setDraft, errors }: Props) {
  const currentYear = new Date().getFullYear();
  const boardNamesQ = useQuery({
    queryKey: ['support-data', 'board-names', 'class12'],
    queryFn: () => fetchBoardNames({ activeOnly: true }),
  });

  return (
    <ErpFormSection
      title="Class XII Academic Background"
      description="Used for MDC, AEC, and VTC eligibility during subject registration. This is separate from your college programme stream."
    >
      <ErpFormGrid>
        <GlassField label="Board" error={errors.boardName}>
          <select
            className={glassSelectClass}
            value={draft.boardName}
            onChange={(e) => setDraft((d) => ({ ...d, boardName: e.target.value }))}
          >
            <option value="">Select board</option>
            {(boardNamesQ.data ?? []).map((board) => (
              <option key={board.id} value={board.label}>
                {board.label} ({board.code})
              </option>
            ))}
          </select>
        </GlassField>
        <GlassField label="School" error={errors.schoolName}>
          <input
            className={glassInputClass}
            value={draft.schoolName}
            onChange={(e) => setDraft((d) => ({ ...d, schoolName: e.target.value }))}
          />
        </GlassField>
        <GlassField label="Board roll number">
          <input
            className={glassInputClass}
            value={draft.boardRollNumber}
            onChange={(e) => setDraft((d) => ({ ...d, boardRollNumber: e.target.value }))}
          />
        </GlassField>
        <GlassField label="Passing year" error={errors.examYear}>
          <input
            type="number"
            min={currentYear - 10}
            max={currentYear}
            className={glassInputClass}
            value={draft.examYear ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                examYear: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </GlassField>
        <GlassField label="Overall marks" error={errors.overallMarks}>
          <input
            type="number"
            min={0}
            className={glassInputClass}
            value={draft.overallMarks ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                overallMarks: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </GlassField>
        <GlassField label="Overall percentage" error={errors.overallPercentage}>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            className={glassInputClass}
            value={draft.overallPercentage ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                overallPercentage: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </GlassField>
        <GlassField label="Class XII stream" error={errors.boardStream}>
          <select
            className={glassSelectClass}
            value={draft.boardStream}
            onChange={(e) => setDraft((d) => ({ ...d, boardStream: e.target.value }))}
          >
            <option value="">Select stream</option>
            {BOARD_STREAM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </GlassField>
      </ErpFormGrid>
      <div className="mt-3">
        <GlassField label="Class XII subjects" error={errors.class12Subjects}>
          <Class12SubjectMultiSelect
            value={draft.class12Subjects}
            boardStream={draft.boardStream}
            onChange={(class12Subjects) => setDraft((d) => ({ ...d, class12Subjects }))}
          />
        </GlassField>
      </div>
    </ErpFormSection>
  );
}
