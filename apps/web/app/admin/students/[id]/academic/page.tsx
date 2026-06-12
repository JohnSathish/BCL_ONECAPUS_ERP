'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  FormField,
  FormGrid,
  erpInputCompact,
  erpSelectClass,
} from '@/components/erp/form-primitives';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  useEligibleMajors,
  useEligibleMinors,
} from '@/components/students-module/add-student/hooks/use-eligible-subjects';
import { SearchableSubjectPathSelect } from '@/components/students-module/add-student/ui/searchable-subject-path-select';
import {
  Class12SubjectMultiSelect,
  type Class12SubjectValue,
} from '@/components/students-module/class12-subject-multi-select';
import {
  fetchStudentAcademicProfile,
  setStudentProgramChoice,
  upsertStudentAcademicProfile,
} from '@/services/academic-engine';
import { fetchAcademicYears } from '@/services/organization';
import { fetchStudent, fetchStudentProfile } from '@/services/students';

export default function StudentAcademicPage() {
  const session = useRequireAuth();
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const qc = useQueryClient();

  const [streamId, setStreamId] = useState('');
  const [admissionYearId, setAdmissionYearId] = useState('');
  const [class12Subjects, setClass12Subjects] = useState<Class12SubjectValue[]>([]);
  const [majorSubjectId, setMajorSubjectId] = useState('');
  const [majorSubjectSlug, setMajorSubjectSlug] = useState('');
  const [minorSubjectId, setMinorSubjectId] = useState('');
  const [minorSubjectSlug, setMinorSubjectSlug] = useState('');

  const student = useQuery({
    queryKey: ['students', studentId],
    queryFn: () => fetchStudent(studentId),
    enabled: Boolean(session) && Boolean(studentId),
  });

  const fullProfile = useQuery({
    queryKey: ['students', studentId, 'profile'],
    queryFn: () => fetchStudentProfile(studentId),
    enabled: Boolean(session) && Boolean(studentId),
  });

  const profile = useQuery({
    queryKey: ['academic-engine', 'profile', studentId],
    queryFn: () => fetchStudentAcademicProfile(studentId),
    enabled: Boolean(session) && Boolean(studentId),
  });

  const programVersionId = student.data?.programVersionId ?? student.data?.programVersion?.id ?? '';

  const semesterSequence = 1;

  const majors = useEligibleMajors({
    programVersionId,
    semesterSequence,
    enabled: Boolean(programVersionId),
  });

  const minors = useEligibleMinors({
    programVersionId,
    majorSubjectSlug,
    semesterSequence,
    enabled: Boolean(programVersionId && majorSubjectSlug),
  });

  const choicesLocked = useMemo(() => {
    const regs = fullProfile.data?.registrations as
      | { semesterSequence?: number; status?: string }[]
      | undefined;
    return regs?.some((r) => r.semesterSequence === 1 && r.status === 'completed') ?? false;
  }, [fullProfile.data?.registrations]);

  const streams = useQuery({
    queryKey: ['academic-engine', 'streams'],
    queryFn: async () => {
      const { fetchAcademicStreams } = await import('@/services/academic-engine');
      return fetchAcademicStreams();
    },
    enabled: Boolean(session),
  });

  const years = useQuery({
    queryKey: ['organization', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: Boolean(session),
  });

  useEffect(() => {
    const p = profile.data?.profile;
    if (!p) return;
    setStreamId(p.streamId ?? '');
    setAdmissionYearId(p.admissionYearId ?? '');
    const subjects = (p.class12Subjects ?? []) as Class12SubjectValue[];
    setClass12Subjects(subjects);
  }, [profile.data]);

  useEffect(() => {
    const major = profile.data?.choices.find((c) => c.choiceType === 'MAJOR');
    const minor = profile.data?.choices.find((c) => c.choiceType === 'MINOR');
    if (major) {
      setMajorSubjectSlug(major.subjectSlug);
      const match = majors.data?.find((m) => m.slug === major.subjectSlug);
      if (match) setMajorSubjectId(match.id);
    }
    if (minor) {
      setMinorSubjectSlug(minor.subjectSlug);
      const match = minors.data?.find((m) => m.slug === minor.subjectSlug);
      if (match) setMinorSubjectId(match.id);
    }
  }, [profile.data, majors.data, minors.data]);

  const saveProfileMut = useMutation({
    mutationFn: () =>
      upsertStudentAcademicProfile(studentId, {
        streamId: streamId || undefined,
        admissionYearId: admissionYearId || undefined,
        class12Subjects,
        languagePreferences: { preferred: 'english' },
        languageEligibility: { allowedSlugs: ['english', 'hindi'] },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'profile', studentId] });
    },
  });

  const saveChoicesMut = useMutation({
    mutationFn: async () => {
      if (!majorSubjectSlug) throw new Error('Select a major subject');
      await setStudentProgramChoice(studentId, {
        choiceType: 'MAJOR',
        subjectSlug: majorSubjectSlug,
      });
      if (minorSubjectSlug) {
        await setStudentProgramChoice(studentId, {
          choiceType: 'MINOR',
          subjectSlug: minorSubjectSlug,
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'profile', studentId] });
      void qc.invalidateQueries({ queryKey: ['students', studentId, 'profile'] });
    },
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Student academic profile">
      <div className="min-w-0 space-y-4">
        <Link
          href="/admin/students"
          className="inline-flex h-8 items-center rounded-md border border-input px-3 text-sm hover:bg-muted"
        >
          Back to students
        </Link>

        <CompactCard>
          <CompactCardHeader
            title={student.data?.enrollmentNumber ?? 'Student'}
            description={student.data?.user.email}
          />
          <CompactCardBody className="space-y-6">
            <FormGrid>
              <FormField label="Academic stream">
                <select
                  className={erpSelectClass}
                  value={streamId}
                  onChange={(e) => setStreamId(e.target.value)}
                >
                  <option value="">Select stream</option>
                  {(streams.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Admission year">
                <select
                  className={erpSelectClass}
                  value={admissionYearId}
                  onChange={(e) => setAdmissionYearId(e.target.value)}
                >
                  <option value="">Select year</option>
                  {(years.data ?? []).map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>

            <FormField label="Class XII subjects">
              <Class12SubjectMultiSelect value={class12Subjects} onChange={setClass12Subjects} />
            </FormField>

            <Button
              size="sm"
              disabled={saveProfileMut.isPending}
              onClick={() => saveProfileMut.mutate()}
            >
              {saveProfileMut.isPending ? 'Saving…' : 'Save profile'}
            </Button>

            <hr className="border-border" />

            <FormGrid>
              <SearchableSubjectPathSelect
                label="Major subject"
                value={majorSubjectId}
                options={majors.data ?? []}
                readOnly={choicesLocked}
                disabled={!programVersionId || majors.isLoading || choicesLocked}
                placeholder="Select major subject"
                onChange={(id, subject) => {
                  setMajorSubjectId(id);
                  setMajorSubjectSlug(subject?.slug ?? '');
                  setMinorSubjectId('');
                  setMinorSubjectSlug('');
                }}
              />
              <SearchableSubjectPathSelect
                label="Minor subject"
                value={minorSubjectId}
                options={minors.data ?? []}
                readOnly={choicesLocked}
                disabled={
                  !programVersionId || !majorSubjectSlug || minors.isLoading || choicesLocked
                }
                placeholder="Select minor subject"
                onChange={(id, subject) => {
                  setMinorSubjectId(id);
                  setMinorSubjectSlug(subject?.slug ?? '');
                }}
              />
            </FormGrid>

            {choicesLocked ? (
              <p className="text-xs text-muted-foreground">
                Major and minor are locked because Semester 1 registration is completed.
              </p>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              disabled={saveChoicesMut.isPending || choicesLocked || !majorSubjectSlug}
              onClick={() => saveChoicesMut.mutate()}
            >
              {saveChoicesMut.isPending ? 'Saving…' : 'Save major / minor choices'}
            </Button>
          </CompactCardBody>
        </CompactCard>
      </div>
    </DashboardShell>
  );
}
