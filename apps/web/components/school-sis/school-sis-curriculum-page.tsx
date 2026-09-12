'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  createSchoolSisSubject,
  createSchoolSisSubjectType,
  deleteSchoolSisSubject,
  deleteSchoolSisSubjectType,
  fetchSchoolSisCurriculum,
  saveSchoolSisClassSubjects,
  updateSchoolSisSubject,
  updateSchoolSisSubjectType,
  type SchoolSisSubject,
  type SchoolSisSubjectType,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const TABS = [
  { id: 'types', label: 'Subject Types' },
  { id: 'list', label: 'Subjects' },
  { id: 'classwise', label: 'Classwise Subject' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SchoolSisCurriculumPage() {
  const enabled = useAuthQueryEnabled();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(user?.permissions);
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'list') as TabId;
  const query = useQuery({
    queryKey: ['school-sis-curriculum'],
    queryFn: fetchSchoolSisCurriculum,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);

  const setTab = (next: TabId) => {
    router.replace(`${pathname}?tab=${next}`);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['school-sis-curriculum'] });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Subjects & curriculum</h1>
        <p className="text-sm text-slate-500">
          Session {query.data?.academicYear.name ?? '—'}. Subject types, subject catalogue, and
          which subjects each class studies.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium',
              tab === item.id
                ? 'bg-[#1a237e] text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {tab === 'types' ? (
        <TypesPanel
          rows={query.data?.types ?? []}
          canManage={canManage}
          onError={setError}
          onDone={() => void refresh()}
        />
      ) : null}
      {tab === 'list' ? (
        <SubjectsPanel
          rows={query.data?.subjects ?? []}
          types={query.data?.types ?? []}
          canManage={canManage}
          onError={setError}
          onDone={() => void refresh()}
        />
      ) : null}
      {tab === 'classwise' ? (
        <ClasswisePanel
          grades={query.data?.grades ?? []}
          subjects={query.data?.subjects ?? []}
          mappings={query.data?.mappings ?? []}
          canManage={canManage}
          onError={setError}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}

function TypesPanel({
  rows,
  canManage,
  onError,
  onDone,
}: {
  rows: SchoolSisSubjectType[];
  canManage: boolean;
  onError: (msg: string | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<SchoolSisSubjectType | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if (editing)
        return updateSchoolSisSubjectType(editing.id, { name: name.trim() || editing.name });
      return createSchoolSisSubjectType({ name: name.trim() });
    },
    onSuccess: () => {
      onError(null);
      setName('');
      setEditing(null);
      onDone();
    },
    onError: (err) => onError(apiErrorMessage(err)),
  });
  return (
    <div className="space-y-4">
      {canManage ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() && !editing) return;
            save.mutate();
          }}
        >
          <label className="text-sm">
            <span className="text-slate-500">{editing ? 'Rename type' : 'New subject type'}</span>
            <input
              className="mt-1 block h-10 w-64 rounded-md border px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Optional Subject"
            />
          </label>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex h-10 items-center gap-1 rounded-md bg-[#1a237e] px-3 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            {editing ? 'Save' : 'Add'}
          </button>
          {editing ? (
            <button
              type="button"
              className="h-10 text-sm text-slate-500"
              onClick={() => {
                setEditing(null);
                setName('');
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>S.No</Th>
            <Th>Subject type</Th>
            <Th>Code</Th>
            {canManage ? <Th>Action</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="border-t">
              <Td>{i + 1}</Td>
              <Td>{row.name}</Td>
              <Td>{row.code}</Td>
              {canManage ? (
                <Td>
                  <IconBtn
                    onClick={() => {
                      setEditing(row);
                      setName(row.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    onClick={() => {
                      if (!window.confirm(`Remove ${row.name}?`)) return;
                      void deleteSchoolSisSubjectType(row.id)
                        .then(() => {
                          onError(null);
                          onDone();
                        })
                        .catch((err) => onError(apiErrorMessage(err)));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function SubjectsPanel({
  rows,
  types,
  canManage,
  onError,
  onDone,
}: {
  rows: SchoolSisSubject[];
  types: SchoolSisSubjectType[];
  canManage: boolean;
  onError: (msg: string | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [maxMarks, setMaxMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('33');
  const [hasTheory, setHasTheory] = useState(true);
  const [hasPractical, setHasPractical] = useState(false);
  const [editing, setEditing] = useState<SchoolSisSubject | null>(null);
  useEffect(() => {
    if (!typeId && types[0]?.id) setTypeId(types[0].id);
  }, [types, typeId]);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim() || editing?.name || '',
        code: code.trim() || undefined,
        subjectTypeId: typeId || undefined,
        maxMarks: maxMarks ? Number(maxMarks) : undefined,
        passMarks: passMarks ? Number(passMarks) : undefined,
        hasTheory,
        hasPractical,
        isOptional: types.find((t) => t.id === typeId)?.code === 'OPTIONAL',
      };
      if (editing) return updateSchoolSisSubject(editing.id, payload);
      return createSchoolSisSubject(payload);
    },
    onSuccess: () => {
      onError(null);
      setName('');
      setCode('');
      setEditing(null);
      onDone();
    },
    onError: (err) => onError(apiErrorMessage(err)),
  });
  return (
    <div className="space-y-4">
      {canManage ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() && !editing) return;
            save.mutate();
          }}
        >
          <Field label={editing ? 'Rename subject' : 'Subject name'}>
            <input
              className="h-10 w-56 rounded-md border px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Code">
            <input
              className="h-10 w-28 rounded-md border px-3"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ENG"
            />
          </Field>
          <Field label="Type">
            <select
              className="h-10 rounded-md border px-3"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Max marks">
            <input
              className="h-10 w-24 rounded-md border px-3"
              value={maxMarks}
              onChange={(e) => setMaxMarks(e.target.value)}
            />
          </Field>
          <Field label="Pass marks">
            <input
              className="h-10 w-24 rounded-md border px-3"
              value={passMarks}
              onChange={(e) => setPassMarks(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasTheory}
              onChange={(e) => setHasTheory(e.target.checked)}
            />
            Theory
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasPractical}
              onChange={(e) => setHasPractical(e.target.checked)}
            />
            Practical
          </label>
          <button
            type="submit"
            disabled={save.isPending}
            className="h-10 rounded-md bg-[#1a237e] px-3 text-sm font-medium text-white"
          >
            {editing ? 'Save' : 'Add subject'}
          </button>
          {editing ? (
            <button
              type="button"
              className="h-10 text-sm text-slate-500"
              onClick={() => {
                setEditing(null);
                setName('');
                setCode('');
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>S.No</Th>
            <Th>Subject</Th>
            <Th>Code</Th>
            <Th>Type</Th>
            <Th>Marks</Th>
            {canManage ? <Th>Action</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="border-t">
              <Td>{i + 1}</Td>
              <Td>{row.name}</Td>
              <Td>{row.code}</Td>
              <Td>{row.subjectType?.name ?? '—'}</Td>
              <Td>
                {row.maxMarks ?? '—'} / {row.passMarks ?? '—'}
              </Td>
              {canManage ? (
                <Td>
                  <IconBtn
                    onClick={() => {
                      setEditing(row);
                      setName(row.name);
                      setCode(row.code);
                      setTypeId(row.subjectTypeId || row.subjectType?.id || '');
                      setMaxMarks(String(row.maxMarks ?? 100));
                      setPassMarks(String(row.passMarks ?? 33));
                      setHasTheory(row.hasTheory !== false);
                      setHasPractical(Boolean(row.hasPractical));
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    onClick={() => {
                      if (!window.confirm(`Remove ${row.name}?`)) return;
                      void deleteSchoolSisSubject(row.id)
                        .then(() => {
                          onError(null);
                          onDone();
                        })
                        .catch((err) => onError(apiErrorMessage(err)));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function ClasswisePanel({
  grades,
  subjects,
  mappings,
  canManage,
  onError,
  onSaved,
}: {
  grades: Array<{ id: string; name: string }>;
  subjects: SchoolSisSubject[];
  mappings: Array<{ gradeId: string; subjectId: string }>;
  canManage: boolean;
  onError: (msg: string | null) => void;
  onSaved: () => void;
}) {
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '');
  const selected = useMemo(
    () => new Set(mappings.filter((m) => m.gradeId === gradeId).map((m) => m.subjectId)),
    [mappings, gradeId],
  );
  const [checked, setChecked] = useState<Set<string>>(selected);
  useEffect(() => {
    setChecked(new Set(selected));
  }, [selected, gradeId]);
  useEffect(() => {
    if (!gradeId && grades[0]?.id) setGradeId(grades[0].id);
  }, [grades, gradeId]);
  const grouped = useMemo(() => {
    const map = new Map<string, SchoolSisSubject[]>();
    for (const subject of subjects.filter((s) => s.active !== false)) {
      const key = subject.subjectType?.name || 'Subjects';
      const list = map.get(key) ?? [];
      list.push(subject);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [subjects]);
  const save = useMutation({
    mutationFn: () => saveSchoolSisClassSubjects({ gradeId, subjectIds: [...checked] }),
    onSuccess: () => {
      onError(null);
      onSaved();
    },
    onError: (err) => onError(apiErrorMessage(err)),
  });
  const gradeName = grades.find((g) => g.id === gradeId)?.name ?? 'Class';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4">
        <Field label="Class">
          <select
            className="h-10 rounded-md border px-3"
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-sm text-slate-500">
          {checked.size} subject{checked.size === 1 ? '' : 's'} selected for {gradeName}
        </p>
        {canManage ? (
          <button
            type="button"
            disabled={!gradeId || save.isPending}
            onClick={() => save.mutate()}
            className="h-10 rounded-md bg-[#1a237e] px-3 text-sm font-medium text-white"
          >
            {save.isPending ? 'Saving…' : 'Save mapping'}
          </button>
        ) : null}
      </div>
      {grouped.map(([typeName, list]) => (
        <div key={typeName} className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#1a237e]">{typeName}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((subject) => {
              const on = checked.has(subject.id);
              return (
                <label
                  key={subject.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={on}
                    onChange={() => {
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (next.has(subject.id)) next.delete(subject.id);
                        else next.add(subject.id);
                        return next;
                      });
                    }}
                  />
                  <span>{subject.name}</span>
                  <span className="text-xs text-slate-400">{subject.code}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium text-slate-500">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2">{children}</td>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <span className="text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mr-1 inline-flex rounded-md p-1 text-slate-500 hover:bg-slate-100"
    >
      {children}
    </button>
  );
}
