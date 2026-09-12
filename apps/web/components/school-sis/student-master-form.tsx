'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bus,
  FileText,
  HeartPulse,
  Home,
  MapPin,
  School,
  StickyNote,
  Upload,
  UserRound,
  Users,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  BLOOD_GROUPS,
  DOCUMENT_SLOTS,
  STUDENT_STATUSES,
  blankStudentMaster,
  type SchoolAddressForm,
  type StudentMasterFormState,
} from '@/lib/school-sis/student-master';
import {
  deleteSchoolSisStudentDocument,
  fetchSchoolSisMasters,
  fetchSchoolSisStudent,
  fetchSchoolSisStudents,
  patchSchoolSisStudentMaster,
  removeSchoolSisStudentPhoto,
  saveSchoolSisStudentMaster,
  uploadSchoolSisStudentDocument,
  uploadSchoolSisStudentPhoto,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function isoDate(value?: string | Date | null) {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function addr(raw: unknown): SchoolAddressForm {
  const o = (raw ?? {}) as Record<string, string>;
  return {
    line: o.line ?? '',
    city: o.city || 'Tura',
    state: o.state || 'Meghalaya',
    district: o.district || 'West Garo Hills',
    pin: o.pin || '',
  };
}

function hydrate(row: Record<string, unknown>, fallbackYearId: string): StudentMasterFormState {
  const base = blankStudentMaster(fallbackYearId);
  const enrollments = (row.enrollments as Array<Record<string, unknown>>) ?? [];
  const current =
    enrollments.find((e) => (e.academicYear as { id?: string })?.id === fallbackYearId) ??
    enrollments[0];
  const section = current?.section as
    | { id?: string; name?: string; grade?: { id?: string; name?: string } }
    | undefined;
  const guardians =
    (row.guardians as Array<{ relationship?: string; guardian: Record<string, unknown> }>) ?? [];
  const pick = (rel: string) =>
    guardians.find((g) => g.relationship === rel || g.guardian.relation === rel)?.guardian;
  const father = pick('FATHER');
  const mother = pick('MOTHER');
  const other = guardians.find(
    (g) => !['FATHER', 'MOTHER'].includes(g.relationship || ''),
  )?.guardian;
  const prev = ((row.previousSchools as Array<Record<string, unknown>>) ?? [])[0];
  const medical = (row.medical as Record<string, unknown> | null) ?? {};
  const siblings = ((row.siblingLinks as Array<Record<string, unknown>>) ?? []).map((link) => {
    const sib = link.sibling as Record<string, unknown>;
    const enr = ((sib.enrollments as Array<Record<string, unknown>>) ?? [])[0];
    const sec = enr?.section as { name?: string; grade?: { name?: string } } | undefined;
    return {
      siblingStudentId: String(sib.id),
      fullName: String(sib.fullName ?? ''),
      admissionNumber: String(sib.admissionNumber ?? ''),
      rollNumber: String((enr?.rollNumber as string) ?? ''),
      classLabel: sec ? `${sec.grade?.name ?? ''} ${sec.name ?? ''}`.trim() : '',
      relationship: String(link.relationship ?? 'SIBLING'),
    };
  });
  const toG = (g?: Record<string, unknown>, rel = 'GUARDIAN') => ({
    id: g?.id as string | undefined,
    fullName: String(g?.fullName ?? ''),
    occupation: String(g?.occupation ?? ''),
    phone: String(g?.phone ?? ''),
    email: String(g?.email ?? ''),
    photoUrl: String(g?.photoUrl ?? ''),
    relationship: rel,
    address: addr(g?.address),
  });
  return {
    ...base,
    photoUrl: String(row.photoUrl ?? ''),
    fullName: String(row.fullName ?? ''),
    dateOfBirth: isoDate(row.dateOfBirth as string),
    gender: String(row.gender ?? ''),
    bloodGroup: String(row.bloodGroup ?? ''),
    house: String(row.house ?? ''),
    religion: String(row.religion ?? ''),
    casteCategory: String(row.casteCategory ?? ''),
    nationality: String(row.nationality ?? 'Indian'),
    motherTongue: String(row.motherTongue ?? ''),
    languagesKnown: Array.isArray(row.languagesKnown) ? (row.languagesKnown as string[]) : [],
    aadhaarNumber: String(row.aadhaarNumber ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    academicYearId: String((current?.academicYear as { id?: string })?.id ?? fallbackYearId),
    admissionNumber: String(row.admissionNumber ?? ''),
    admissionDate:
      isoDate((current?.admissionDate as string) ?? null) || isoDate(row.createdAt as string),
    rollNumber: String(current?.rollNumber ?? ''),
    gradeId: String(section?.grade?.id ?? ''),
    sectionId: String(section?.id ?? ''),
    status: String(row.status ?? 'ACTIVE'),
    enrollmentLocked: Boolean(current?.id),
    hasSiblings: siblings.length > 0,
    siblings,
    currentAddress: addr(row.currentAddress),
    permanentAddress: addr(row.permanentAddress),
    permanentSameAsCurrent:
      JSON.stringify(row.currentAddress ?? {}) === JSON.stringify(row.permanentAddress ?? {}),
    usesTransport: Boolean(row.usesTransport),
    transport: {
      routeId: String((row.transportJson as Record<string, string> | undefined)?.routeId ?? ''),
      vehicleId: String((row.transportJson as Record<string, string> | undefined)?.vehicleId ?? ''),
      pickupPoint: String(
        (row.transportJson as Record<string, string> | undefined)?.pickupPoint ?? '',
      ),
      dropPoint: String((row.transportJson as Record<string, string> | undefined)?.dropPoint ?? ''),
    },
    usesHostel: Boolean(row.usesHostel),
    hostel: {
      hostelId: String((row.hostelJson as Record<string, string> | undefined)?.hostelId ?? ''),
      roomNumber: String((row.hostelJson as Record<string, string> | undefined)?.roomNumber ?? ''),
      joinedAt: isoDate((row.hostelJson as Record<string, string> | undefined)?.joinedAt ?? null),
    },
    father: toG(father, 'FATHER'),
    mother: toG(mother, 'MOTHER'),
    guardian: toG(other, String(other?.relation ?? 'GUARDIAN')),
    guardianType: (['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'].includes(String(row.guardianType))
      ? row.guardianType
      : father
        ? 'FATHER'
        : other
          ? 'GUARDIAN'
          : 'FATHER') as StudentMasterFormState['guardianType'],
    guardianSameAsFather: !other,
    medicalHealth: String(medical.medicalHealth ?? 'GOOD'),
    allergies: Array.isArray(medical.allergies) ? (medical.allergies as string[]) : [],
    medicalConditions: String(medical.medicalConditions ?? ''),
    medications: String(medical.medications ?? ''),
    emergencyNotes: String(medical.emergencyNotes ?? ''),
    noPreviousSchool: !prev,
    previousSchool: {
      schoolName: String(prev?.schoolName ?? ''),
      address: String(prev?.address ?? ''),
      lastClass: String(prev?.lastClass ?? ''),
      yearOfLeaving: String(prev?.yearOfLeaving ?? ''),
      tcNumber: String(prev?.tcNumber ?? ''),
      tcDate: isoDate(prev?.tcDate as string),
    },
    bankName: String(row.bankName ?? ''),
    bankBranch: String(row.bankBranch ?? ''),
    bankIfsc: String(row.bankIfsc ?? ''),
    remarks: String(row.remarks ?? ''),
  };
}

function cleanGuardian(g: StudentMasterFormState['father']) {
  return {
    ...g,
    email: g.email || undefined,
    phone: g.phone || undefined,
    photoUrl: g.photoUrl || undefined,
    id: g.id || undefined,
  };
}

function toPayload(form: StudentMasterFormState, autosave: boolean) {
  return {
    autosave,
    fullName: form.fullName.trim(),
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    bloodGroup: form.bloodGroup || undefined,
    house: form.house || undefined,
    religion: form.religion || undefined,
    casteCategory: form.casteCategory || undefined,
    nationality: form.nationality || undefined,
    motherTongue: form.motherTongue || undefined,
    languagesKnown: form.languagesKnown,
    aadhaarNumber: form.aadhaarNumber || undefined,
    email: form.email || undefined,
    phone: form.phone || undefined,
    photoUrl: form.photoUrl || undefined,
    status: form.status,
    academicYearId: form.academicYearId || undefined,
    sectionId: form.sectionId || undefined,
    rollNumber: form.rollNumber || undefined,
    admissionDate: form.admissionDate || undefined,
    admissionNumber: form.admissionNumber || undefined,
    hasSiblings: form.hasSiblings,
    siblings: form.hasSiblings
      ? form.siblings.map((s) => ({
          siblingStudentId: s.siblingStudentId,
          relationship: s.relationship,
        }))
      : [],
    currentAddress: form.currentAddress,
    permanentAddress: form.permanentSameAsCurrent ? form.currentAddress : form.permanentAddress,
    permanentSameAsCurrent: form.permanentSameAsCurrent,
    usesTransport: form.usesTransport,
    transport: form.usesTransport ? form.transport : undefined,
    usesHostel: form.usesHostel,
    hostel: form.usesHostel
      ? { ...form.hostel, joinedAt: form.hostel.joinedAt || undefined }
      : undefined,
    father: cleanGuardian(form.father),
    mother: cleanGuardian(form.mother),
    guardian: form.guardianSameAsFather ? undefined : cleanGuardian(form.guardian),
    guardianType: form.guardianType,
    guardianSameAsFather: form.guardianSameAsFather,
    medicalHealth: form.medicalHealth || undefined,
    allergies: form.allergies,
    medicalConditions: form.medicalConditions || undefined,
    medications: form.medications || undefined,
    emergencyNotes: form.emergencyNotes || undefined,
    previousSchool: form.noPreviousSchool
      ? { none: true }
      : {
          none: false,
          ...form.previousSchool,
          tcDate: form.previousSchool.tcDate || undefined,
        },
    bankName: form.bankName || undefined,
    bankBranch: form.bankBranch || undefined,
    bankIfsc: form.bankIfsc || undefined,
    remarks: form.remarks || undefined,
  };
}

function Field({
  label,
  required,
  children,
  hint,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[13px] text-slate-700">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </Label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SectionCard({
  n,
  title,
  description,
  icon: Icon,
  children,
  extra,
}: {
  n: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-100 bg-sky-50 px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#1a365d] shadow-sm">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[#1a365d]">
              {n}. {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
        </div>
        {extra}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm';

export function StudentMasterForm({ studentId }: { studentId?: string }) {
  const router = useRouter();
  const enabled = useAuthQueryEnabled();
  const [id, setId] = useState(studentId);
  const [form, setForm] = useState<StudentMasterFormState>(() => blankStudentMaster());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('Not saved yet');
  const [error, setError] = useState<string | null>(null);
  const [langDraft, setLangDraft] = useState('');
  const [allergyDraft, setAllergyDraft] = useState('');
  const [siblingQ, setSiblingQ] = useState('');
  const [docs, setDocs] = useState<
    Array<{ id: string; slot: string; fileName: string; storageKey?: string | null }>
  >([]);
  const snapshot = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(id);
  idRef.current = id;

  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const existing = useQuery({
    queryKey: ['school-sis-student', studentId],
    queryFn: () => fetchSchoolSisStudent(studentId!),
    enabled: enabled && Boolean(studentId),
  });
  const siblingHits = useQuery({
    queryKey: ['school-sis-students', siblingQ],
    queryFn: () => fetchSchoolSisStudents({ q: siblingQ }),
    enabled: enabled && siblingQ.length >= 2,
  });

  const years = masters.data?.academicYears?.length
    ? masters.data.academicYears
    : masters.data?.academicYear
      ? [masters.data.academicYear]
      : [];
  const allSections = masters.data?.allSections ?? masters.data?.sections ?? [];
  const yearSections = allSections.filter(
    (s) => !form.academicYearId || s.academicYearId === form.academicYearId || !s.academicYearId,
  );
  const grades = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    yearSections.forEach((s) => map.set(s.grade.id, s.grade));
    return [...map.values()];
  }, [yearSections]);
  const sectionsForGrade = yearSections.filter((s) => form.gradeId && s.grade.id === form.gradeId);

  useEffect(() => {
    if (!masters.data) return;
    const yearId = masters.data.academicYear.id;
    if (!studentId) {
      const stored = localStorage.getItem('sls-student-master-draft');
      const next = stored
        ? ({ ...blankStudentMaster(yearId), ...JSON.parse(stored) } as StudentMasterFormState)
        : blankStudentMaster(yearId);
      if (!next.academicYearId) next.academicYearId = yearId;
      setForm(next);
      snapshot.current = JSON.stringify(next);
    }
  }, [masters.data, studentId]);

  useEffect(() => {
    if (!existing.data || !masters.data) return;
    const next = hydrate(existing.data as Record<string, unknown>, masters.data.academicYear.id);
    setForm(next);
    setDocs(((existing.data as { documents?: typeof docs }).documents ?? []) as typeof docs);
    snapshot.current = JSON.stringify(next);
    setDirty(false);
    setSaveNote('Loaded');
  }, [existing.data, masters.data]);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const patch = useCallback((partial: Partial<StudentMasterFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  }, []);

  const persistLocal = useCallback((next: StudentMasterFormState) => {
    if (!idRef.current) localStorage.setItem('sls-student-master-draft', JSON.stringify(next));
  }, []);

  const runSave = useCallback(
    async (autosave: boolean) => {
      if (autosave && form.fullName.trim().length < 2) return;
      setSaving(true);
      setError(null);
      try {
        const payload = toPayload(form, autosave);
        const row = idRef.current
          ? await patchSchoolSisStudentMaster(idRef.current, payload)
          : await saveSchoolSisStudentMaster(payload);
        if (!idRef.current) {
          localStorage.removeItem('sls-student-master-draft');
          setId(row.id);
          idRef.current = row.id;
          router.replace(`/admin/school-sis/students/${row.id}/edit`);
        }
        setForm((prev) => ({
          ...prev,
          admissionNumber: row.admissionNumber,
          enrollmentLocked: Boolean(prev.sectionId) || prev.enrollmentLocked,
        }));
        snapshot.current = JSON.stringify({
          ...form,
          admissionNumber: row.admissionNumber,
          enrollmentLocked: Boolean(form.sectionId) || form.enrollmentLocked,
        });
        setDirty(false);
        setSaveNote(autosave ? `Auto-saved ${new Date().toLocaleTimeString()}` : 'Saved');
      } catch (err) {
        if (!autosave) setError(apiErrorMessage(err));
        else setSaveNote('Auto-save waiting for required fields');
      } finally {
        setSaving(false);
      }
    },
    [form, router],
  );

  useEffect(() => {
    if (!dirty) return;
    persistLocal(form);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runSave(true);
    }, 1800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, form, persistLocal, runSave]);

  const reset = () => {
    if (snapshot.current) {
      setForm(JSON.parse(snapshot.current) as StudentMasterFormState);
      setDirty(false);
      setSaveNote('Reset to last saved');
    }
  };

  const leave = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave this page?')) return;
    router.push('/admin/school-sis/students');
  };

  const addTag = (key: 'languagesKnown' | 'allergies', value: string) => {
    const v = value.trim();
    if (!v) return;
    if (form[key].includes(v)) return;
    patch({ [key]: [...form[key], v] });
  };

  async function onPhoto(kind: 'STUDENT' | 'FATHER' | 'MOTHER' | 'GUARDIAN', file?: File) {
    if (!file) return;
    if (!idRef.current) {
      await runSave(true);
    }
    if (!idRef.current) {
      setError('Enter Full Name first so the record can auto-save, then upload the photo.');
      return;
    }
    try {
      const { url } = await uploadSchoolSisStudentPhoto(idRef.current, file, kind);
      if (kind === 'STUDENT') patch({ photoUrl: url });
      if (kind === 'FATHER') patch({ father: { ...form.father, photoUrl: url } });
      if (kind === 'MOTHER') patch({ mother: { ...form.mother, photoUrl: url } });
      if (kind === 'GUARDIAN') patch({ guardian: { ...form.guardian, photoUrl: url } });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function onDoc(slot: string, file?: File) {
    if (!file || !idRef.current) {
      setError('Save the student first, then upload documents.');
      return;
    }
    try {
      const row = (await uploadSchoolSisStudentDocument(idRef.current, slot, file)) as {
        id: string;
        slot: string;
        fileName: string;
        storageKey?: string | null;
      };
      setDocs((prev) => [row, ...prev.filter((d) => d.slot !== row.slot)]);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const editing = Boolean(id);
  const title = editing ? 'Edit Student' : 'Add Student';

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold text-[#1a365d]">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Dashboard / Students / {title}</p>
      </div>

      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-100 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <Button type="button" variant="outline" onClick={leave}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Students
        </Button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={cn(saving && 'text-sky-700')}>{saving ? 'Saving…' : saveNote}</span>
          <Button type="button" variant="outline" onClick={reset} disabled={!dirty}>
            Reset
          </Button>
          <Button
            type="button"
            className="bg-[#2563eb] hover:bg-[#1d4ed8]"
            disabled={saving}
            onClick={() => void runSave(false)}
          >
            {editing ? 'Save Changes' : 'Save Student'}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <SectionCard
        n={1}
        title="Personal Information"
        description="Official identity as it appears on documents. Full Name is never split."
        icon={UserRound}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="h-28 w-28 overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
            {form.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#2563eb] px-3 text-sm text-[#2563eb]">
                {form.photoUrl ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void onPhoto('STUDENT', e.target.files?.[0])}
                />
              </label>
              {form.photoUrl && id ? (
                <Button
                  type="button"
                  className="h-9 bg-[#2563eb]"
                  onClick={() => {
                    void removeSchoolSisStudentPhoto(id).then(() => patch({ photoUrl: '' }));
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-500">JPG, PNG or WEBP. Maximum 4MB.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Full Name" required className="sm:col-span-2">
            <Input
              className={inputClass}
              placeholder="e.g. John Sathish"
              value={form.fullName}
              onChange={(e) => patch({ fullName: e.target.value })}
            />
          </Field>
          <Field label="Date of Birth" required>
            <Input
              type="date"
              className={inputClass}
              value={form.dateOfBirth}
              onChange={(e) => patch({ dateOfBirth: e.target.value })}
            />
          </Field>
          <Field label="Gender" required>
            <select
              className={inputClass}
              value={form.gender}
              onChange={(e) => patch({ gender: e.target.value })}
            >
              <option value="">Select</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </Field>
          <Field label="Blood Group">
            <select
              className={inputClass}
              value={form.bloodGroup}
              onChange={(e) => patch({ bloodGroup: e.target.value as never })}
            >
              <option value="">Select</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="House">
            <select
              className={inputClass}
              value={form.house}
              onChange={(e) => patch({ house: e.target.value })}
            >
              <option value="">Not assigned</option>
              {['Red', 'Blue', 'Green', 'Yellow'].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Religion">
            <Input
              className={inputClass}
              placeholder="e.g. Christianity"
              value={form.religion}
              onChange={(e) => patch({ religion: e.target.value })}
            />
          </Field>
          <Field label="Caste / Category">
            <select
              className={inputClass}
              value={form.casteCategory}
              onChange={(e) => patch({ casteCategory: e.target.value })}
            >
              <option value="">Select</option>
              <option>ST</option>
              <option>SC</option>
              <option>OBC</option>
              <option>General</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Nationality">
            <Input
              className={inputClass}
              value={form.nationality}
              onChange={(e) => patch({ nationality: e.target.value })}
            />
          </Field>
          <Field label="Mother Tongue">
            <Input
              className={inputClass}
              placeholder="e.g. Garo"
              value={form.motherTongue}
              onChange={(e) => patch({ motherTongue: e.target.value })}
            />
          </Field>
          <Field label="Languages Known" className="sm:col-span-2">
            <div className="flex min-h-10 flex-wrap gap-1 rounded-md border border-slate-200 px-2 py-1">
              {form.languagesKnown.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-[#1a365d]"
                  onClick={() =>
                    patch({ languagesKnown: form.languagesKnown.filter((x) => x !== l) })
                  }
                >
                  {l} ×
                </button>
              ))}
              <input
                className="min-w-[8rem] flex-1 text-sm outline-none"
                placeholder="Type and Enter"
                value={langDraft}
                onChange={(e) => setLangDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('languagesKnown', langDraft);
                    setLangDraft('');
                  }
                }}
              />
            </div>
          </Field>
          <Field label="Aadhaar Number" hint="Optional. 12 digits. Shown masked after save.">
            <Input
              className={inputClass}
              inputMode="numeric"
              placeholder="XXXX XXXX XXXX"
              value={form.aadhaarNumber}
              onChange={(e) => patch({ aadhaarNumber: e.target.value })}
            />
          </Field>
          <Field label="Student Email">
            <Input
              className={inputClass}
              type="email"
              placeholder="student@example.in"
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
            />
          </Field>
          <Field label="Primary Contact Number">
            <Input
              className={inputClass}
              placeholder="94361xxxxx"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        n={2}
        title="Academic & Enrollment Information"
        description="Class and section belong to this year’s enrollment, not the student identity."
        icon={GraduationCap}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Academic Year" required>
            <select
              className={inputClass}
              value={form.academicYearId}
              onChange={(e) =>
                patch({ academicYearId: e.target.value, sectionId: '', gradeId: '' })
              }
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Admission Number" hint="System-generated SLS/year/sequence">
            <Input
              className={inputClass}
              value={form.admissionNumber}
              placeholder="SLS/2026/0001"
              readOnly
            />
          </Field>
          <Field label="Admission Date" required>
            <Input
              type="date"
              className={inputClass}
              value={form.admissionDate}
              onChange={(e) => patch({ admissionDate: e.target.value })}
            />
          </Field>
          <Field label="Roll Number" hint="Auto-generated SLS26-0001 (year + sequence)">
            <Input
              className={inputClass}
              value={form.rollNumber}
              readOnly
              placeholder="Assigned on save"
            />
          </Field>
          <Field label="Student Status" required>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => patch({ status: e.target.value })}
            >
              {STUDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0] + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class" required>
            <select
              className={inputClass}
              disabled={form.enrollmentLocked}
              value={form.gradeId}
              onChange={(e) => patch({ gradeId: e.target.value, sectionId: '' })}
            >
              <option value="">Select</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section" required>
            <select
              className={inputClass}
              disabled={form.enrollmentLocked}
              value={form.sectionId}
              onChange={(e) => patch({ sectionId: e.target.value })}
            >
              <option value="">Select</option>
              {sectionsForGrade.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.grade.name} {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {form.enrollmentLocked ? (
          <p className="mt-3 text-xs text-slate-500">
            Class and section for an existing year are locked. Use promotion to move the student to
            a new class.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        n={3}
        title="Siblings"
        description="Link existing students. Do not create a second identity for the same child."
        icon={Users}
      >
        <div className="mb-3 flex gap-4 text-sm">
          <span>Is any sibling studying in the same school?</span>
          {(['Yes', 'No'] as const).map((opt) => (
            <label key={opt} className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={form.hasSiblings === (opt === 'Yes')}
                onChange={() =>
                  patch({ hasSiblings: opt === 'Yes', siblings: opt === 'No' ? [] : form.siblings })
                }
              />
              {opt}
            </label>
          ))}
        </div>
        {form.hasSiblings ? (
          <div className="space-y-3">
            <Input
              className={inputClass}
              placeholder="Search by full name or admission number"
              value={siblingQ}
              onChange={(e) => setSiblingQ(e.target.value)}
            />
            {siblingHits.data
              ?.filter((s) => s.id !== id)
              .slice(0, 6)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-sky-50"
                  onClick={() => {
                    if (form.siblings.some((x) => x.siblingStudentId === s.id)) return;
                    patch({
                      siblings: [
                        ...form.siblings,
                        {
                          siblingStudentId: s.id,
                          fullName: s.fullName,
                          admissionNumber: s.admissionNumber,
                          rollNumber: s.enrollments[0]?.rollNumber ?? '',
                          classLabel: s.enrollments[0]
                            ? `${s.enrollments[0].section.grade.name} ${s.enrollments[0].section.name}`
                            : '',
                          relationship: 'SIBLING',
                        },
                      ],
                    });
                    setSiblingQ('');
                  }}
                >
                  {s.fullName} · {s.admissionNumber}
                </button>
              ))}
            {form.siblings.map((s) => (
              <div
                key={s.siblingStudentId}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6"
              >
                <div className="sm:col-span-2 text-sm font-medium">{s.fullName}</div>
                <div className="text-xs text-slate-500">{s.admissionNumber}</div>
                <div className="text-xs text-slate-500">{s.rollNumber || '—'}</div>
                <div className="text-xs text-slate-500">{s.classLabel || '—'}</div>
                <div className="flex items-center gap-2">
                  <select
                    className={inputClass}
                    value={s.relationship}
                    onChange={(e) =>
                      patch({
                        siblings: form.siblings.map((x) =>
                          x.siblingStudentId === s.siblingStudentId
                            ? { ...x, relationship: e.target.value }
                            : x,
                        ),
                      })
                    }
                  >
                    <option value="SIBLING">Sibling</option>
                    <option value="BROTHER">Brother</option>
                    <option value="SISTER">Sister</option>
                    <option value="TWIN">Twin</option>
                  </select>
                  <button
                    type="button"
                    className="text-rose-600"
                    onClick={() =>
                      patch({
                        siblings: form.siblings.filter(
                          (x) => x.siblingStudentId !== s.siblingStudentId,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        n={4}
        title="Address Information"
        description="Indian address fields for Tura / West Garo Hills."
        icon={MapPin}
      >
        <AddressBlock
          title="Current Address"
          value={form.currentAddress}
          onChange={(currentAddress) => patch({ currentAddress })}
        />
        <label className="mt-4 mb-3 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.permanentSameAsCurrent}
            onChange={(e) => patch({ permanentSameAsCurrent: e.target.checked })}
          />
          Same as Current Address
        </label>
        {!form.permanentSameAsCurrent ? (
          <AddressBlock
            title="Permanent Address"
            value={form.permanentAddress}
            onChange={(permanentAddress) => patch({ permanentAddress })}
          />
        ) : null}
      </SectionCard>

      <SectionCard
        n={5}
        title="Transport Information"
        description="References future Transport ERP records. No duplicate vehicle master here."
        icon={Bus}
        extra={
          <label className="inline-flex items-center gap-2 text-sm">
            <span>Uses School Transport</span>
            <input
              type="checkbox"
              checked={form.usesTransport}
              onChange={(e) => patch({ usesTransport: e.target.checked })}
            />
          </label>
        }
      >
        {form.usesTransport ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Route">
              <Input
                className={inputClass}
                placeholder="Route code (later from Transport)"
                value={form.transport.routeId}
                onChange={(e) =>
                  patch({ transport: { ...form.transport, routeId: e.target.value } })
                }
              />
            </Field>
            <Field label="Vehicle">
              <Input
                className={inputClass}
                placeholder="Vehicle id"
                value={form.transport.vehicleId}
                onChange={(e) =>
                  patch({ transport: { ...form.transport, vehicleId: e.target.value } })
                }
              />
            </Field>
            <Field label="Pickup Point">
              <Input
                className={inputClass}
                placeholder="e.g. Walbakgre junction"
                value={form.transport.pickupPoint}
                onChange={(e) =>
                  patch({ transport: { ...form.transport, pickupPoint: e.target.value } })
                }
              />
            </Field>
            <Field label="Drop Point">
              <Input
                className={inputClass}
                placeholder="e.g. School gate"
                value={form.transport.dropPoint}
                onChange={(e) =>
                  patch({ transport: { ...form.transport, dropPoint: e.target.value } })
                }
              />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Day scholar — transport fields hidden.</p>
        )}
      </SectionCard>

      <SectionCard
        n={6}
        title="Hostel Information"
        description="Optional. Leave off for day scholars."
        icon={Home}
        extra={
          <label className="inline-flex items-center gap-2 text-sm">
            <span>Hostel student</span>
            <input
              type="checkbox"
              checked={form.usesHostel}
              onChange={(e) => patch({ usesHostel: e.target.checked })}
            />
          </label>
        }
      >
        {form.usesHostel ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Hostel">
              <Input
                className={inputClass}
                placeholder="Hostel name / id"
                value={form.hostel.hostelId}
                onChange={(e) => patch({ hostel: { ...form.hostel, hostelId: e.target.value } })}
              />
            </Field>
            <Field label="Room Number">
              <Input
                className={inputClass}
                value={form.hostel.roomNumber}
                onChange={(e) => patch({ hostel: { ...form.hostel, roomNumber: e.target.value } })}
              />
            </Field>
            <Field label="Date of Joining">
              <Input
                type="date"
                className={inputClass}
                value={form.hostel.joinedAt}
                onChange={(e) => patch({ hostel: { ...form.hostel, joinedAt: e.target.value } })}
              />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Hostel not required.</p>
        )}
      </SectionCard>

      <SectionCard
        n={7}
        title="Parents & Guardian Information"
        description="Shared guardian records so siblings can use one parent account."
        icon={Users}
      >
        <GuardianBlock
          title="Father's Information"
          person={form.father}
          onChange={(father) => patch({ father })}
          onPhoto={(f) => void onPhoto('FATHER', f)}
        />
        <div className="my-6 border-t" />
        <GuardianBlock
          title="Mother's Information"
          person={form.mother}
          onChange={(mother) => patch({ mother })}
          onPhoto={(f) => void onPhoto('MOTHER', f)}
        />
        <div className="my-6 border-t" />
        <p className="mb-3 text-sm font-medium">If Guardian Is</p>
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          {(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'] as const).map((g) => (
            <label key={g} className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={form.guardianType === g}
                onChange={() =>
                  patch({
                    guardianType: g,
                    guardianSameAsFather: g === 'FATHER',
                  })
                }
              />
              {g[0] + g.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
        {form.guardianType === 'FATHER' || form.guardianSameAsFather ? (
          <p className="text-sm text-slate-500">
            Primary guardian is the father. One guardian record can cover multiple children.
          </p>
        ) : form.guardianType === 'MOTHER' ? (
          <p className="text-sm text-slate-500">Primary guardian is the mother.</p>
        ) : (
          <GuardianBlock
            title="Guardian Information"
            person={form.guardian}
            showAddress
            onChange={(guardian) => patch({ guardian })}
            onPhoto={(f) => void onPhoto('GUARDIAN', f)}
          />
        )}
      </SectionCard>

      <SectionCard
        n={8}
        title="Student Documents"
        description="Files are stored on disk. Only metadata is kept in the database."
        icon={FileText}
      >
        {!id ? (
          <p className="text-sm text-slate-500">
            Auto-save the student first, then attach documents.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {DOCUMENT_SLOTS.map((slot) => {
              const doc = docs.find((d) => d.slot === slot.id);
              return (
                <div key={slot.id} className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="text-xs text-slate-500">PDF, JPG, PNG or WEBP. Max 4MB.</p>
                  {doc ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <a
                        className="text-[#2563eb] underline"
                        href={doc.storageKey ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {doc.fileName}
                      </a>
                      <label className="cursor-pointer text-[#2563eb]">
                        Replace
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => void onDoc(slot.id, e.target.files?.[0])}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-rose-600"
                        onClick={() => {
                          if (!window.confirm('Delete this document?')) return;
                          void deleteSchoolSisStudentDocument(id, doc.id).then(() =>
                            setDocs((prev) => prev.filter((d) => d.id !== doc.id)),
                          );
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <label className="mt-2 inline-flex h-9 cursor-pointer items-center gap-1 rounded-md bg-[#2563eb] px-3 text-sm text-white">
                      <Upload className="h-4 w-4" />
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => void onDoc(slot.id, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        n={9}
        title="Medical Information"
        description="Sensitive. Visible only to authorised school office staff."
        icon={HeartPulse}
      >
        <Field label="General Health">
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              ['GOOD', 'Good'],
              ['NEEDS_ATTENTION', 'Needs Attention'],
              ['OTHER', 'Other'],
            ].map(([v, l]) => (
              <label key={v} className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  checked={form.medicalHealth === v}
                  onChange={() => patch({ medicalHealth: v })}
                />
                {l}
              </label>
            ))}
          </div>
        </Field>
        <div className="mt-4 grid gap-4">
          <Field label="Allergies">
            <div className="flex min-h-10 flex-wrap gap-1 rounded-md border px-2 py-1">
              {form.allergies.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-xs"
                  onClick={() => patch({ allergies: form.allergies.filter((x) => x !== a) })}
                >
                  {a} ×
                </button>
              ))}
              <input
                className="flex-1 text-sm outline-none"
                placeholder="Add and press Enter"
                value={allergyDraft}
                onChange={(e) => setAllergyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('allergies', allergyDraft);
                    setAllergyDraft('');
                  }
                }}
              />
            </div>
          </Field>
          <Field label="Medical Conditions">
            <textarea
              className="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
              value={form.medicalConditions}
              onChange={(e) => patch({ medicalConditions: e.target.value })}
            />
          </Field>
          <Field label="Medications">
            <textarea
              className="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
              value={form.medications}
              onChange={(e) => patch({ medications: e.target.value })}
            />
          </Field>
          <Field label="Emergency medical notes">
            <textarea
              className="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
              value={form.emergencyNotes}
              onChange={(e) => patch({ emergencyNotes: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        n={10}
        title="Previous School Details"
        description="Optional for first-time admissions."
        icon={School}
      >
        <label className="mb-4 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.noPreviousSchool}
            onChange={(e) => patch({ noPreviousSchool: e.target.checked })}
          />
          No previous school
        </label>
        {!form.noPreviousSchool ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Previous School Name">
              <Input
                className={inputClass}
                placeholder="e.g. Don Bosco Higher Secondary, Tura"
                value={form.previousSchool.schoolName}
                onChange={(e) =>
                  patch({ previousSchool: { ...form.previousSchool, schoolName: e.target.value } })
                }
              />
            </Field>
            <Field label="School Address">
              <Input
                className={inputClass}
                placeholder="Tura, West Garo Hills, Meghalaya"
                value={form.previousSchool.address}
                onChange={(e) =>
                  patch({ previousSchool: { ...form.previousSchool, address: e.target.value } })
                }
              />
            </Field>
            <Field label="Last Class Studied">
              <Input
                className={inputClass}
                value={form.previousSchool.lastClass}
                onChange={(e) =>
                  patch({ previousSchool: { ...form.previousSchool, lastClass: e.target.value } })
                }
              />
            </Field>
            <Field label="Year of Passing / Leaving">
              <Input
                className={inputClass}
                placeholder="2025"
                value={form.previousSchool.yearOfLeaving}
                onChange={(e) =>
                  patch({
                    previousSchool: { ...form.previousSchool, yearOfLeaving: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Transfer Certificate Number">
              <Input
                className={inputClass}
                value={form.previousSchool.tcNumber}
                onChange={(e) =>
                  patch({ previousSchool: { ...form.previousSchool, tcNumber: e.target.value } })
                }
              />
            </Field>
            <Field label="Transfer Certificate Date">
              <Input
                type="date"
                className={inputClass}
                value={form.previousSchool.tcDate}
                onChange={(e) =>
                  patch({ previousSchool: { ...form.previousSchool, tcDate: e.target.value } })
                }
              />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        n={11}
        title="Other Details"
        description="Remarks for office use. Bank fields are optional."
        icon={StickyNote}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Bank Name">
            <Input
              className={inputClass}
              placeholder="Optional"
              value={form.bankName}
              onChange={(e) => patch({ bankName: e.target.value })}
            />
          </Field>
          <Field label="Branch">
            <Input
              className={inputClass}
              placeholder="e.g. Tura"
              value={form.bankBranch}
              onChange={(e) => patch({ bankBranch: e.target.value })}
            />
          </Field>
          <Field label="IFSC Code">
            <Input
              className={inputClass}
              placeholder="SBIN0000000"
              value={form.bankIfsc}
              onChange={(e) => patch({ bankIfsc: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Additional Remarks" className="mt-4">
          <textarea
            className="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm"
            value={form.remarks}
            onChange={(e) => patch({ remarks: e.target.value })}
          />
        </Field>
      </SectionCard>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={leave}>
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-[#2563eb]"
          disabled={saving}
          onClick={() => void runSave(false)}
        >
          {editing ? 'Save Changes' : 'Save Student'}
        </Button>
      </div>
    </div>
  );
}

function AddressBlock({
  title,
  value,
  onChange,
}: {
  title: string;
  value: SchoolAddressForm;
  onChange: (next: SchoolAddressForm) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-[#1a365d]">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Address" className="sm:col-span-2 lg:col-span-5">
          <Input
            className={inputClass}
            placeholder="House / locality, Walbakgre"
            value={value.line}
            onChange={(e) => onChange({ ...value, line: e.target.value })}
          />
        </Field>
        <Field label="City / Town">
          <Input
            className={inputClass}
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
        </Field>
        <Field label="State">
          <Input
            className={inputClass}
            value={value.state}
            onChange={(e) => onChange({ ...value, state: e.target.value })}
          />
        </Field>
        <Field label="District">
          <Input
            className={inputClass}
            value={value.district}
            onChange={(e) => onChange({ ...value, district: e.target.value })}
          />
        </Field>
        <Field label="PIN Code">
          <Input
            className={inputClass}
            inputMode="numeric"
            placeholder="794101"
            value={value.pin}
            onChange={(e) => onChange({ ...value, pin: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function GuardianBlock({
  title,
  person,
  onChange,
  onPhoto,
  showAddress,
}: {
  title: string;
  person: StudentMasterFormState['father'];
  onChange: (next: StudentMasterFormState['father']) => void;
  onPhoto: (file?: File) => void;
  showAddress?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-[#1a365d]">{title}</p>
      <div className="mb-4 flex gap-3">
        <div className="h-20 w-20 overflow-hidden rounded-xl border border-dashed bg-slate-50">
          {person.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#2563eb] px-3 text-sm text-[#2563eb]">
          Upload
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Full Name">
          <Input
            className={inputClass}
            placeholder="As on official records"
            value={person.fullName}
            onChange={(e) => onChange({ ...person, fullName: e.target.value })}
          />
        </Field>
        <Field label="Occupation">
          <Input
            className={inputClass}
            value={person.occupation}
            onChange={(e) => onChange({ ...person, occupation: e.target.value })}
          />
        </Field>
        <Field label="Phone Number">
          <Input
            className={inputClass}
            placeholder="94361xxxxx"
            value={person.phone}
            onChange={(e) => onChange({ ...person, phone: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            className={inputClass}
            type="email"
            value={person.email}
            onChange={(e) => onChange({ ...person, email: e.target.value })}
          />
        </Field>
        {showAddress ? (
          <>
            <Field label="Relationship">
              <Input
                className={inputClass}
                placeholder="Uncle / Grandparent"
                value={person.relationship}
                onChange={(e) => onChange({ ...person, relationship: e.target.value })}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2 lg:col-span-3">
              <Input
                className={inputClass}
                value={person.address.line}
                onChange={(e) =>
                  onChange({ ...person, address: { ...person.address, line: e.target.value } })
                }
              />
            </Field>
          </>
        ) : null}
      </div>
    </div>
  );
}
