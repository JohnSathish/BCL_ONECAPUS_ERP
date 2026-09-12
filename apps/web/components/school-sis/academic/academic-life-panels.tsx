'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  addSchoolClubActivity,
  applySchoolPromotion,
  assignSchoolClubMembers,
  assignSchoolHouseMembers,
  fetchSchoolAcademicClasses,
  fetchSchoolClubs,
  fetchSchoolHouses,
  fetchSchoolIdCards,
  fetchSchoolOptionals,
  fetchSchoolPromotion,
  fetchSchoolSisStudents,
  previewSchoolIdCard,
  saveSchoolClub,
  saveSchoolHouse,
  saveSchoolIdCard,
  saveSchoolOptionalMapping,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import {
  AcademicCard,
  AcademicPageHeader,
  AcademicTable,
  EmptyState,
  Field,
  GhostButton,
  PrimaryButton,
  SkeletonRows,
  StatusBadge,
  Td,
  Th,
  confirmAction,
  fieldClass,
} from './academic-ui';

export function AcademicOptionalsPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const [sectionId, setSectionId] = useState('');
  const query = useQuery({
    queryKey: ['school-optionals', sectionId],
    queryFn: () => fetchSchoolOptionals(sectionId || undefined),
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Optional subject mapping"
        description="Assign electives to students in the current year. Core subjects stay on the class mapping."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <select
        className={`${fieldClass} max-w-xs`}
        value={sectionId}
        onChange={(e) => setSectionId(e.target.value)}
      >
        <option value="">All sections</option>
        {(classes.data?.sections ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.grade.name} {s.name}
          </option>
        ))}
      </select>
      {query.isLoading ? <SkeletonRows /> : null}
      {!query.isLoading && !query.data?.students.length ? (
        <EmptyState title="No students" hint="Enrol students first, then map optionals." />
      ) : null}
      {(query.data?.students ?? []).map((student) => (
        <AcademicCard
          key={student.id}
          className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <p className="font-medium">{student.fullName}</p>
            <p className="text-xs text-slate-500">
              {student.admissionNumber} · {student.className}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(query.data?.subjects ?? []).map((subject) => {
              const on = student.subjectIds.includes(subject.id);
              return (
                <label
                  key={subject.id}
                  className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={on}
                    onChange={() => {
                      const next = on
                        ? student.subjectIds.filter((id) => id !== subject.id)
                        : [...student.subjectIds, subject.id];
                      void saveSchoolOptionalMapping({ studentId: student.id, subjectIds: next })
                        .then(() => {
                          setError(null);
                          void qc.invalidateQueries({ queryKey: ['school-optionals'] });
                        })
                        .catch((err) => setError(apiErrorMessage(err)));
                    }}
                  />
                  {subject.name}
                </label>
              );
            })}
          </div>
        </AcademicCard>
      ))}
    </div>
  );
}

export function AcademicHousesPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const houses = useQuery({ queryKey: ['school-houses'], queryFn: fetchSchoolHouses, enabled });
  const students = useQuery({
    queryKey: ['school-sis-students'],
    queryFn: () => fetchSchoolSisStudents(),
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', color: '#0ea5e9', captainName: '' });
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Student house mapping"
        description="Create houses and bulk-assign students. A student can belong to one house per academic year."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {canManage ? (
        <AcademicCard>
          <form
            className="grid gap-2 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveSchoolHouse(form)
                .then(() => {
                  setForm({ name: '', color: '#0ea5e9', captainName: '' });
                  void qc.invalidateQueries({ queryKey: ['school-houses'] });
                })
                .catch((err) => setError(apiErrorMessage(err)));
            }}
          >
            <input
              className={fieldClass}
              placeholder="House name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              className={fieldClass}
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
            <input
              className={fieldClass}
              placeholder="Captain"
              value={form.captainName}
              onChange={(e) => setForm({ ...form, captainName: e.target.value })}
            />
            <PrimaryButton type="submit">Add house</PrimaryButton>
          </form>
        </AcademicCard>
      ) : null}
      {houses.isLoading ? <SkeletonRows /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {(houses.data?.houses ?? []).map((house) => (
          <AcademicCard key={house.id}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ background: house.color }} />
              <h2 className="font-semibold">{house.name}</h2>
              <span className="text-xs text-slate-500">{house.memberships.length} students</span>
            </div>
            <p className="text-sm text-slate-500">
              Captain {house.captainName || '—'} · Teacher {house.teacher?.fullName || '—'}
            </p>
            {canManage ? (
              <>
                <select
                  multiple
                  className="mt-3 h-32 w-full rounded-lg border p-2 text-sm"
                  value={picked[house.id] ?? []}
                  onChange={(e) =>
                    setPicked((p) => ({
                      ...p,
                      [house.id]: [...e.target.selectedOptions].map((o) => o.value),
                    }))
                  }
                >
                  {(students.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} · {s.admissionNumber}
                    </option>
                  ))}
                </select>
                <PrimaryButton
                  className="mt-2"
                  type="button"
                  onClick={() => {
                    void assignSchoolHouseMembers({
                      houseId: house.id,
                      studentIds: picked[house.id] ?? [],
                    })
                      .then(() => qc.invalidateQueries({ queryKey: ['school-houses'] }))
                      .catch((err) => setError(apiErrorMessage(err)));
                  }}
                >
                  Assign selected
                </PrimaryButton>
              </>
            ) : null}
            <ul className="mt-3 max-h-40 overflow-auto text-sm">
              {house.memberships.map((m) => (
                <li key={m.student.id}>{m.student.fullName}</li>
              ))}
            </ul>
          </AcademicCard>
        ))}
      </div>
    </div>
  );
}

export function AcademicClubsPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const clubs = useQuery({ queryKey: ['school-clubs'], queryFn: fetchSchoolClubs, enabled });
  const students = useQuery({
    queryKey: ['school-sis-students'],
    queryFn: () => fetchSchoolSisStudents(),
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Student club mapping"
        description="Clubs are year-bound. Members and activities stay with this academic year."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {canManage ? (
        <AcademicCard>
          <form
            className="grid gap-2 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveSchoolClub({ name, description })
                .then(() => {
                  setName('');
                  setDescription('');
                  void qc.invalidateQueries({ queryKey: ['school-clubs'] });
                })
                .catch((err) => setError(apiErrorMessage(err)));
            }}
          >
            <input
              className={fieldClass}
              placeholder="Club name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={fieldClass}
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <PrimaryButton type="submit">Add club</PrimaryButton>
          </form>
        </AcademicCard>
      ) : null}
      {(clubs.data?.clubs ?? []).map((club) => (
        <AcademicCard key={club.id}>
          <h2 className="font-semibold">{club.name}</h2>
          <p className="text-sm text-slate-500">
            {club.description || '—'} · Coordinator {club.coordinator?.fullName || '—'}
          </p>
          {canManage ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Members</p>
                <select
                  multiple
                  className="h-32 w-full rounded-lg border p-2 text-sm"
                  defaultValue={club.members.map((m) => m.student.id)}
                  id={`club-${club.id}`}
                >
                  {(students.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
                <PrimaryButton
                  className="mt-2"
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(
                      `club-${club.id}`,
                    ) as HTMLSelectElement | null;
                    const ids = el ? [...el.selectedOptions].map((o) => o.value) : [];
                    void assignSchoolClubMembers(club.id, ids)
                      .then(() => qc.invalidateQueries({ queryKey: ['school-clubs'] }))
                      .catch((err) => setError(apiErrorMessage(err)));
                  }}
                >
                  Save members
                </PrimaryButton>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Activity</p>
                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    void addSchoolClubActivity(club.id, {
                      title: String(fd.get('title') || ''),
                      activityDate: String(fd.get('date') || '') || undefined,
                      notes: String(fd.get('notes') || '') || undefined,
                    })
                      .then(() => {
                        e.currentTarget.reset();
                        void qc.invalidateQueries({ queryKey: ['school-clubs'] });
                      })
                      .catch((err) => setError(apiErrorMessage(err)));
                  }}
                >
                  <input
                    name="title"
                    className={fieldClass}
                    placeholder="Activity title"
                    required
                  />
                  <input name="date" type="date" className={fieldClass} />
                  <input name="notes" className={fieldClass} placeholder="Notes" />
                  <PrimaryButton type="submit">Add activity</PrimaryButton>
                </form>
                <ul className="mt-2 text-sm">
                  {club.activities.map((a) => (
                    <li key={a.id}>
                      {a.title} {a.activityDate ? `· ${a.activityDate.slice(0, 10)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </AcademicCard>
      ))}
    </div>
  );
}

export function AcademicPromotionPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const [sectionId, setSectionId] = useState('');
  const [toSectionId, setToSectionId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-promotion', sectionId],
    queryFn: () => fetchSchoolPromotion(sectionId || undefined),
    enabled,
  });
  const currentSections = (query.data?.sections ?? []).filter(
    (s) => s.academicYearId === query.data?.academicYear.id,
  );
  const otherSections = (query.data?.sections ?? []).filter(
    (s) => s.academicYearId !== query.data?.academicYear.id,
  );

  const run = (action: 'PROMOTE' | 'HOLD' | 'WITHDRAW') => {
    if (!selected.length) return;
    if (action === 'PROMOTE' && !toSectionId) {
      setError('Choose the promotion class/section');
      return;
    }
    if (!confirmAction(`${action} ${selected.length} student(s)? Previous year records are kept.`))
      return;
    void applySchoolPromotion({
      studentIds: selected,
      action,
      toSectionId: toSectionId || undefined,
    })
      .then(() => {
        setError(null);
        setSelected([]);
        void qc.invalidateQueries({ queryKey: ['school-promotion'] });
      })
      .catch((err) => setError(apiErrorMessage(err)));
  };

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Student promotion"
        description="Promote, hold back or withdraw without overwriting previous enrolments. History is stored as events."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <select
          className={`${fieldClass} max-w-xs`}
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="">Current class (all)</option>
          {currentSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.grade.name} {s.name}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} max-w-xs`}
          value={toSectionId}
          onChange={(e) => setToSectionId(e.target.value)}
        >
          <option value="">Promotion class/section</option>
          {otherSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.academicYear.name} · {s.grade.name} {s.name}
            </option>
          ))}
          {currentSections.map((s) => (
            <option key={`c-${s.id}`} value={s.id}>
              Same year · {s.grade.name} {s.name}
            </option>
          ))}
        </select>
        {canManage ? (
          <>
            <PrimaryButton type="button" onClick={() => run('PROMOTE')}>
              Promote selected
            </PrimaryButton>
            <GhostButton type="button" onClick={() => run('HOLD')}>
              Hold back
            </GhostButton>
            <GhostButton type="button" onClick={() => run('WITHDRAW')}>
              Withdraw
            </GhostButton>
          </>
        ) : null}
      </div>
      {query.isLoading ? (
        <SkeletonRows />
      ) : (
        <AcademicTable>
          <thead>
            <tr>
              <Th>
                {canManage ? (
                  <input
                    type="checkbox"
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? (query.data?.students ?? []).map((s) => s.studentId)
                          : [],
                      )
                    }
                  />
                ) : (
                  '#'
                )}
              </Th>
              <Th>Student</Th>
              <Th>Admission</Th>
              <Th>Class</Th>
              <Th>Roll</Th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.students ?? []).map((row) => (
              <tr key={row.studentId} className="border-t">
                <Td>
                  {canManage ? (
                    <input
                      type="checkbox"
                      checked={selected.includes(row.studentId)}
                      onChange={() =>
                        setSelected((s) =>
                          s.includes(row.studentId)
                            ? s.filter((id) => id !== row.studentId)
                            : [...s, row.studentId],
                        )
                      }
                    />
                  ) : null}
                </Td>
                <Td className="font-medium">{row.fullName}</Td>
                <Td>{row.admissionNumber}</Td>
                <Td>{row.className}</Td>
                <Td>{row.rollNumber ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </AcademicTable>
      )}
      <AcademicCard>
        <h2 className="mb-2 text-sm font-semibold">Promotion history</h2>
        <ul className="max-h-64 space-y-1 overflow-auto text-sm">
          {(query.data?.history ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap gap-2">
              <StatusBadge value={row.type} />
              <span>{row.student.fullName}</span>
              <span className="text-slate-400">
                {new Date(row.createdAt).toLocaleString('en-IN')}
              </span>
              {row.note ? <span className="text-slate-500">{row.note}</span> : null}
            </li>
          ))}
        </ul>
      </AcademicCard>
    </div>
  );
}

export function AcademicIdCardsPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['school-id-cards'], queryFn: fetchSchoolIdCards, enabled });
  const [name, setName] = useState('Student ID');
  const [layout, setLayout] = useState({
    showLogo: true,
    showPhoto: true,
    showName: true,
    showAdmission: true,
    showClass: true,
    showYear: true,
    showBloodGroup: true,
    showQr: true,
    contactLine: '',
    accentColor: '#1a365d',
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const preview = useQuery({
    queryKey: ['school-id-preview', activeId],
    queryFn: () => previewSchoolIdCard(activeId!),
    enabled: enabled && Boolean(activeId),
  });
  const [error, setError] = useState<string | null>(null);
  const sample = preview.data;

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="ID card template"
        description="Toggle fields and preview before saving. Print uses the same student, class and admission data."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AcademicCard>
          {canManage ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void saveSchoolIdCard(
                  { name, status: 'ACTIVE', isDefault: true, layoutJson: layout },
                  activeId ?? undefined,
                )
                  .then((row: { id: string }) => {
                    setActiveId(row.id);
                    void qc.invalidateQueries({ queryKey: ['school-id-cards'] });
                  })
                  .catch((err) => setError(apiErrorMessage(err)));
              }}
            >
              <Field label="Template name">
                <input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(layout)
                  .filter(([, v]) => typeof v === 'boolean')
                  .map(([key, value]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => setLayout({ ...layout, [key]: e.target.checked })}
                      />
                      {key.replace('show', '')}
                    </label>
                  ))}
              </div>
              <Field label="Contact line">
                <input
                  className={fieldClass}
                  value={layout.contactLine}
                  onChange={(e) => setLayout({ ...layout, contactLine: e.target.value })}
                />
              </Field>
              <PrimaryButton type="submit">Save template</PrimaryButton>
            </form>
          ) : null}
          <ul className="mt-4 space-y-1 text-sm">
            {(list.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="text-[var(--school-erp-primary)]"
                  onClick={() => {
                    setActiveId(row.id);
                    setName(row.name);
                  }}
                >
                  {row.name}
                </button>
                {row.isDefault ? <StatusBadge value="ACTIVE" /> : null}
              </li>
            ))}
          </ul>
        </AcademicCard>
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Live preview
          </p>
          <div
            className="overflow-hidden rounded-2xl border bg-white shadow-lg"
            style={{ borderColor: layout.accentColor }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 text-white"
              style={{ background: layout.accentColor }}
            >
              {layout.showLogo && sample?.school.logoUrl ? (
                <img src={sample.school.logoUrl} alt="" className="h-10 w-auto" />
              ) : null}
              <div>
                <p className="text-sm font-semibold">
                  {sample?.school.name ?? "St. Luke's Secondary School"}
                </p>
                {layout.showYear ? (
                  <p className="text-[11px] opacity-80">{sample?.academicYear.name}</p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-3 p-4">
              {layout.showPhoto ? (
                <div className="h-24 w-20 overflow-hidden rounded-lg bg-slate-100">
                  {sample?.student.photoUrl ? (
                    <img
                      src={sample.student.photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="min-w-0 text-sm">
                {layout.showName ? (
                  <p className="font-semibold">{sample?.student.fullName ?? 'Sample Student'}</p>
                ) : null}
                {layout.showAdmission ? <p>Adm {sample?.student.admissionNumber}</p> : null}
                {layout.showClass ? <p>{sample?.student.className}</p> : null}
                {layout.showBloodGroup ? <p>Blood {sample?.student.bloodGroup ?? '—'}</p> : null}
              </div>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] text-slate-500">
              <span>{layout.contactLine || sample?.school.address || 'Tura'}</span>
              {layout.showQr ? (
                <span className="rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-white">
                  QR
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
