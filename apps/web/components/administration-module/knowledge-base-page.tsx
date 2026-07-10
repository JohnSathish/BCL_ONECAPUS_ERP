'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminGlassCard, AdminShell } from '@/components/administration-module/ui/admin-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  downloadCoursesTemplate,
  getKnowledgeStatus,
  REGULATION_UPLOAD_TYPES,
  seedFyugpFramework,
  syncErpCatalogToKnowledge,
  uploadCoursesExcel,
  uploadCurriculumPdf,
  uploadRegulationPdf,
} from '@/services/knowledge-base';
import { cn } from '@/utils/cn';

export function KnowledgeBasePage() {
  const qc = useQueryClient();
  const pdfRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const regulationRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regTitle, setRegTitle] = useState('');
  const [regType, setRegType] = useState<(typeof REGULATION_UPLOAD_TYPES)[number]['value']>(
    REGULATION_UPLOAD_TYPES[0].value,
  );

  const statusQ = useQuery({
    queryKey: ['knowledge-base-status'],
    queryFn: getKnowledgeStatus,
  });

  const run = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async (result) => {
      setError(null);
      setMessage(
        typeof result === 'object' && result && 'courses' in result
          ? `Done — ${(result as { courses: number }).courses} courses, ${(result as { semesterPlans?: number }).semesterPlans ?? 0} semester plans in Knowledge Base.`
          : 'Done.',
      );
      await qc.invalidateQueries({ queryKey: ['knowledge-base-status'] });
    },
    onError: (err: unknown) => {
      setMessage(null);
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Action failed',
      );
    },
  });

  const docs = statusQ.data?.documents ?? [];
  const active = docs.find((d) => d.id === statusQ.data?.activeDocumentId);
  const bySem = statusQ.data?.coursesBySemester ?? [];
  const pending = run.isPending || statusQ.isFetching;

  return (
    <AdminShell>
      <AdminPageHeader
        title="Knowledge Base"
        subtitle="Feed NEP / NEHU syllabus into structured knowledge so OneCampus AI answers from the database — not by re-reading PDFs."
      />

      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">How to feed all semester NEP syllabus</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed">
          <li>
            <strong>Seed FYUGP framework</strong> — loads Semesters 1–8 structure (20 credits each,
            160 total) and definitions (MDC, SEC, FYUP…).
          </li>
          <li>
            <strong>Sync from ERP catalog</strong> — pulls every active course already in OneCampus
            (fastest if programmes are configured).
          </li>
          <li>
            <strong>Or upload Excel</strong> — download the template, fill Sem 1–8 course rows,
            upload. Columns: course_code, course_name, category, credits, semester.
          </li>
          <li>
            <strong>Optional PDF</strong> — upload NEHU Curriculum Framework PDF as a reference
            source (also seeds framework + Sem 1 catalogue).
          </li>
        </ol>
      </div>

      {message ? (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminGlassCard className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-slate-900">Feed actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionCard
              icon={Database}
              title="1. Seed FYUGP framework"
              body="All 8 semester plans, definitions, and credit facts from official NEHU FYUGP rules."
              disabled={pending}
              onClick={() => run.mutate(() => seedFyugpFramework())}
            />
            <ActionCard
              icon={RefreshCw}
              title="2. Sync ERP course catalog"
              body="Import active courses from academic catalogue (with semester from offerings)."
              disabled={pending}
              onClick={() => run.mutate(() => syncErpCatalogToKnowledge())}
            />
            <ActionCard
              icon={Download}
              title="Download Excel template"
              body="Blank syllabus sheet with sample Sem 1 rows — fill Sem 2–8 and upload."
              disabled={pending}
              onClick={() =>
                run.mutate(async () => {
                  await downloadCoursesTemplate();
                  return { courses: active?._count.courses ?? 0, semesterPlans: 8 };
                })
              }
            />
            <ActionCard
              icon={FileSpreadsheet}
              title="Upload courses Excel"
              body="Bulk-load course_code, course_name, category, credits, semester for any semester."
              disabled={pending}
              onClick={() => excelRef.current?.click()}
            />
            <ActionCard
              icon={FileUp}
              title="Upload curriculum PDF"
              body="NEHU Curriculum & Credit Framework PDF — extracts codes and seeds full framework."
              disabled={pending}
              onClick={() => pdfRef.current?.click()}
            />
          </div>

          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) run.mutate(() => uploadCurriculumPdf(file));
            }}
          />
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) run.mutate(() => uploadCoursesExcel(file));
            }}
          />
        </AdminGlassCard>

        <AdminGlassCard className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-slate-900">Active knowledge</h2>
          </div>
          {statusQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : active ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-900">{active.title}</p>
              <p className="text-xs text-slate-500">
                Version {active.version ?? '—'} · {active.status}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Stat label="Courses" value={active._count.courses} />
                <Stat label="Semesters" value={active._count.semesterPlans} />
                <Stat label="Definitions" value={active._count.definitions} />
                <Stat label="Facts" value={active._count.facts} />
              </dl>
              {bySem.length ? (
                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Courses by semester
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {bySem.map((row) => (
                      <li
                        key={String(row.semester)}
                        className="flex justify-between rounded-md bg-slate-50 px-2 py-1"
                      >
                        <span>
                          {row.semester == null ? 'Unassigned' : `Semester ${row.semester}`}
                        </span>
                        <span className="font-semibold">{row.courses}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No active curriculum knowledge yet. Start with Seed FYUGP framework or Sync ERP
              catalog.
            </p>
          )}
        </AdminGlassCard>
      </div>

      <AdminGlassCard className="mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileUp className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-sm font-semibold text-slate-900">Regulations &amp; policies</h2>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-slate-600">
          Upload examination rules, attendance policy, fee rules, hostel rules, HR manuals, etc. The
          AI will answer from these documents with source and page references.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">
              Document title
            </label>
            <Input
              value={regTitle}
              onChange={(e) => setRegTitle(e.target.value)}
              placeholder="e.g. NEHU Examination Regulations 2024"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Category</label>
            <select
              value={regType}
              onChange={(e) =>
                setRegType(e.target.value as (typeof REGULATION_UPLOAD_TYPES)[number]['value'])
              }
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              {REGULATION_UPLOAD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="h-9 w-full"
              disabled={pending || !regTitle.trim()}
              onClick={() => regulationRef.current?.click()}
            >
              Upload regulation PDF
            </Button>
          </div>
        </div>
        <input
          ref={regulationRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file && regTitle.trim()) {
              run.mutate(() =>
                uploadRegulationPdf(file, {
                  title: regTitle.trim(),
                  sourceType: regType,
                }),
              );
            }
          }}
        />
      </AdminGlassCard>

      <AdminGlassCard className="mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Document versions</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">No documents ingested yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Type</th>
                  <th className="px-2 py-1.5 font-semibold">Title</th>
                  <th className="px-2 py-1.5 font-semibold">Version</th>
                  <th className="px-2 py-1.5 font-semibold">Status</th>
                  <th className="px-2 py-1.5 font-semibold">Courses</th>
                  <th className="px-2 py-1.5 font-semibold">Semesters</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-600">{doc.sourceType}</td>
                    <td className="px-2 py-1.5 text-slate-800">{doc.title}</td>
                    <td className="px-2 py-1.5">{doc.version ?? '—'}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          doc.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{doc._count.courses}</td>
                    <td className="px-2 py-1.5">{doc._count.semesterPlans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminGlassCard>

      <p className="mt-4 text-xs text-slate-500">
        After feeding, ask OneCampus AI: “Can Semester III students change their Major?”, “Show all
        Semester III students with pending fees”, “What is the attendance requirement?”
      </p>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-base font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  body,
  onClick,
  disabled,
}: {
  icon: typeof Database;
  title: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[#2563EB]/40 hover:bg-[#2563EB]/5 disabled:opacity-50"
    >
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#2563EB]" />
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-600">{body}</p>
      <span className="mt-2 inline-flex items-center text-[11px] font-semibold text-[#2563EB]">
        {disabled ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Working…
          </>
        ) : (
          'Run'
        )}
      </span>
    </button>
  );
}
