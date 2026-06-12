'use client';

import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';

import { ErpFormGrid, ErpFormSection } from '@/components/erp/erp-workspace-shell';
import type { StepId } from '@/components/students-module/add-student/constants';
import { admissionDocumentLabel } from '@/components/students-module/add-student/constants/documents';
import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import type { LookupOptions } from '@/components/students-module/add-student/types/lookups';
import {
  GlassField,
  glassInputClass,
  glassSelectClass,
} from '@/components/students-module/add-student/ui/glass-field';
import { inputClass } from '@/components/student-profile/student-profile-shell';
import { fetchBoardSubjects } from '@/services/support-data';

type Props = {
  step: StepId;
  draft: AddStudentDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStudentDraft>>;
  lookups: LookupOptions;
  onJumpToStep?: (index: number) => void;
  programmeLabel?: string;
};

function GuardianBlock({
  title,
  value,
  onChange,
}: {
  title: string;
  value: AddStudentDraft['father'];
  onChange: (v: AddStudentDraft['father']) => void;
}) {
  return (
    <div className="glass-card space-y-2 rounded-lg border border-border/50 p-2.5">
      <h3 className="text-xs font-semibold">{title}</h3>
      <ErpFormGrid>
        <GlassField label="Name">
          <input
            className={glassInputClass}
            value={value.fullName}
            onChange={(e) => onChange({ ...value, fullName: e.target.value })}
          />
        </GlassField>
        <GlassField label="Contact">
          <input
            className={glassInputClass}
            value={value.contactNumber}
            onChange={(e) => onChange({ ...value, contactNumber: e.target.value })}
          />
        </GlassField>
        <GlassField label="Occupation">
          <input
            className={glassInputClass}
            value={value.occupation}
            onChange={(e) => onChange({ ...value, occupation: e.target.value })}
          />
        </GlassField>
      </ErpFormGrid>
    </div>
  );
}

function AddressBlock({
  title,
  value,
  onChange,
  disabled,
}: {
  title: string;
  value: AddStudentDraft['tura'];
  onChange: (v: AddStudentDraft['tura']) => void;
  disabled?: boolean;
}) {
  const fields: { key: keyof AddStudentDraft['tura']; label: string }[] = [
    { key: 'line1', label: 'Address line 1' },
    { key: 'line2', label: 'Address line 2' },
    { key: 'city', label: 'City' },
    { key: 'district', label: 'District' },
    { key: 'state', label: 'State' },
    { key: 'pinCode', label: 'PIN Code' },
  ];
  return (
    <div className="space-y-2">
      {title ? <h3 className="text-xs font-semibold">{title}</h3> : null}
      <ErpFormGrid>
        {fields.map(({ key, label }) => (
          <GlassField key={key} label={label}>
            <input
              className={glassInputClass}
              disabled={disabled}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </GlassField>
        ))}
      </ErpFormGrid>
    </div>
  );
}

export function StepMisc({ step, draft, setDraft, lookups, onJumpToStep, programmeLabel }: Props) {
  const boardSubjectsQ = useQuery({
    queryKey: ['support-data', 'board-subjects', 'subject-marks'],
    queryFn: () => fetchBoardSubjects({ activeOnly: true }),
  });
  const boardSubjectOptions = (boardSubjectsQ.data ?? []).sort((a, b) => {
    const aPriority = streamPriority(a.metadata?.category, draft.boardStream);
    const bPriority = streamPriority(b.metadata?.category, draft.boardStream);
    return bPriority - aPriority || a.label.localeCompare(b.label);
  });

  if (step === 'guardians') {
    return (
      <ErpFormSection title="Guardians & family">
        <div className="grid gap-2 lg:grid-cols-3">
          <GuardianBlock
            title="Father"
            value={draft.father}
            onChange={(father) => setDraft((d) => ({ ...d, father }))}
          />
          <GuardianBlock
            title="Mother"
            value={draft.mother}
            onChange={(mother) => setDraft((d) => ({ ...d, mother }))}
          />
          <GuardianBlock
            title="Local guardian"
            value={draft.localGuardian}
            onChange={(localGuardian) => setDraft((d) => ({ ...d, localGuardian }))}
          />
        </div>
      </ErpFormSection>
    );
  }

  if (step === 'address') {
    return (
      <div className="space-y-3">
        <ErpFormSection title="Address in Tura">
          <AddressBlock
            title=""
            value={draft.tura}
            onChange={(tura) => setDraft((d) => ({ ...d, tura }))}
          />
        </ErpFormSection>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.homeSameAsTura}
            onChange={(e) => setDraft((d) => ({ ...d, homeSameAsTura: e.target.checked }))}
          />
          Home address same as Tura
        </label>
        {!draft.homeSameAsTura ? (
          <ErpFormSection title="Home address">
            <AddressBlock
              title=""
              value={draft.home}
              onChange={(home) => setDraft((d) => ({ ...d, home }))}
            />
          </ErpFormSection>
        ) : null}
      </div>
    );
  }

  if (step === 'reservation') {
    return (
      <ErpFormSection title="Reservation details">
        <ErpFormGrid>
          <GlassField label="Denomination">
            <select
              className={glassSelectClass}
              value={draft.denominationLookupId}
              onChange={(e) => setDraft((d) => ({ ...d, denominationLookupId: e.target.value }))}
            >
              <option value="">Optional</option>
              {lookups.denominationOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.differentlyAbled}
              onChange={(e) => setDraft((d) => ({ ...d, differentlyAbled: e.target.checked }))}
            />
            Differently abled
          </label>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.ews}
              onChange={(e) => setDraft((d) => ({ ...d, ews: e.target.checked }))}
            />
            Economically Weaker Section (EWS)
          </label>
        </ErpFormGrid>
      </ErpFormSection>
    );
  }

  if (step === 'board') {
    const addMarkRow = () => {
      setDraft((d) => ({
        ...d,
        subjectMarks: [
          ...d.subjectMarks,
          { subjectName: '', marksObtained: undefined, maxMarks: undefined },
        ],
      }));
    };

    const removeMarkRow = (idx: number) => {
      setDraft((d) => ({
        ...d,
        subjectMarks: d.subjectMarks.filter((_, i) => i !== idx),
      }));
    };

    return (
      <div className="space-y-6">
        <ErpFormSection
          title="Subject marks (optional)"
          description="Per-subject marks for records. Class XII subjects were captured on the Academic step."
        >
          <div className="space-y-2">
            {draft.subjectMarks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No mark rows yet.</p>
            ) : (
              draft.subjectMarks.map((m, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                  <input
                    list="board-subject-mark-options"
                    className={inputClass}
                    placeholder="Search subject, e.g. Physics"
                    value={m.subjectName}
                    onChange={(e) => {
                      const next = [...draft.subjectMarks];
                      next[idx] = { ...next[idx], subjectName: e.target.value };
                      setDraft((d) => ({ ...d, subjectMarks: next }));
                    }}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Obtained"
                    value={m.marksObtained ?? ''}
                    onChange={(e) => {
                      const next = [...draft.subjectMarks];
                      next[idx] = {
                        ...next[idx],
                        marksObtained: e.target.value ? Number(e.target.value) : undefined,
                      };
                      setDraft((d) => ({ ...d, subjectMarks: next }));
                    }}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Max"
                    value={m.maxMarks ?? ''}
                    onChange={(e) => {
                      const next = [...draft.subjectMarks];
                      next[idx] = {
                        ...next[idx],
                        maxMarks: e.target.value ? Number(e.target.value) : undefined,
                      };
                      setDraft((d) => ({ ...d, subjectMarks: next }));
                    }}
                  />
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove subject mark row ${idx + 1}`}
                    title="Remove row"
                    onClick={() => removeMarkRow(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
            <datalist id="board-subject-mark-options">
              {boardSubjectOptions.map((subject) => (
                <option key={subject.id} value={`${subject.label} (${subject.code})`} />
              ))}
            </datalist>
            <button type="button" className="text-xs text-primary underline" onClick={addMarkRow}>
              Add mark row
            </button>
          </div>
        </ErpFormSection>
        <ErpFormSection title="CUET">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.cuetApplied}
              onChange={(e) => setDraft((d) => ({ ...d, cuetApplied: e.target.checked }))}
            />
            CUET applied
          </label>
          {draft.cuetApplied ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <GlassField label="CUET roll number">
                <input
                  className={glassInputClass}
                  value={draft.cuetRollNumber}
                  onChange={(e) => setDraft((d) => ({ ...d, cuetRollNumber: e.target.value }))}
                />
              </GlassField>
              <GlassField label="CUET score">
                <input
                  className={glassInputClass}
                  type="number"
                  value={draft.cuetScore ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      cuetScore: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </GlassField>
            </div>
          ) : null}
        </ErpFormSection>
      </div>
    );
  }

  if (step === 'review') {
    const creditsSelected = draft.subjectBasketMeta.creditsSelected ?? 0;
    const creditsTarget = draft.subjectBasketMeta.creditsTarget ?? 0;
    const rows: [string, string][] = [
      ['Name', draft.fullName],
      ['Email', draft.email],
      ['Application No.', draft.applicationNumber],
      ['NEHU Registration Number', draft.enrollmentNumber],
      ['NEHU Roll Number', draft.nehuRollNumber || '—'],
      [
        'Roll Number',
        draft.rollNumberAutoGenerated ? draft.rollNumberPreview || '—' : draft.rollNumber || '—',
      ],
      ['Programme', programmeLabel ?? '—'],
      ['Major', draft.majorSubjectSlug || '—'],
      ['Minor', draft.minorSubjectSlug || '—'],
      ['Class XII board', draft.boardName || '—'],
      ['Class XII subjects', String(draft.class12Subjects.length)],
      ['Documents queued', String(draft.pendingDocuments.length)],
      ['Subjects selected', String(Object.keys(draft.subjectSelections).length)],
      [
        'Semester credits',
        creditsTarget ? `${creditsSelected} / ${creditsTarget}` : String(creditsSelected),
      ],
    ];
    return (
      <div className="space-y-4">
        {creditsTarget > 0 && creditsSelected !== creditsTarget ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            Credit total must be exactly {creditsTarget} before you can complete admission.
            Currently {creditsSelected}. Return to the Subjects step and pick pool courses with the
            correct credit weight (often 3 credits each for MDC/AEC/SEC/VAC).
          </p>
        ) : null}
        <dl className="grid gap-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="glass-card rounded-xl border border-border/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v || '—'}</dd>
            </div>
          ))}
        </dl>
        {draft.pendingDocuments.length > 0 ? (
          <div className="glass-card rounded-xl border border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Queued documents</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {draft.pendingDocuments.map((doc) => (
                <li key={doc.id}>
                  {admissionDocumentLabel(doc.documentType)} — {doc.fileName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {onJumpToStep ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                className="text-primary underline"
                onClick={() => onJumpToStep(i)}
              >
                Edit step {i + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function streamPriority(category: unknown, stream?: string) {
  const normalizedCategory = String(category ?? '').toUpperCase();
  const normalizedStream = String(stream ?? '').toUpperCase();
  if (!normalizedStream) return 0;
  if (normalizedCategory === normalizedStream) return 2;
  if (normalizedCategory === 'LANGUAGE' || normalizedCategory === 'GENERAL') return 1;
  return 0;
}
