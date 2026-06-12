'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileArchive, ImagePlus, Trash2, UploadCloud } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DirectoryAdvancedFiltersDrawer } from '@/components/students-module/directory/directory-advanced-filters-drawer';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches, listAcademicSessions } from '@/services/academic-lifecycle';
import {
  fetchAcademicDepartments,
  fetchCampuses,
  fetchInstitutions,
} from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import {
  applyStudentPhotoBulkUpload,
  buildPhotoScopeFilter,
  deleteStudentPhotosBulk,
  downloadStudentPhotoBulkReport,
  downloadStudentPhotoIdentifierList,
  fetchStudentPhotoBulkJobs,
  previewStudentPhotoBulkUpload,
  reprocessStudentPhotosBulk,
  type PhotoBulkBatch,
  type PhotoIdentifierStrategy,
} from '@/services/student-photo-bulk';
import { fetchMasterLookups } from '@/services/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const emptyFilters: DirectoryFilters = {
  search: '',
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  admissionStatus: '',
  academicStatus: '',
  departmentId: '',
  sessionId: '',
  categoryLookupId: '',
  religionLookupId: '',
  differentlyAbled: '',
  studentStatus: '',
  admissionType: '',
  uiSubjectPending: '',
  uiFeeDue: '',
  uiHostel: '',
  uiRfidAssigned: '',
  uiAttendanceShortage: '',
  uiRecentlyAdded: '',
};

const identifierOptions: { id: PhotoIdentifierStrategy; label: string; example: string }[] = [
  { id: 'rollNumber', label: 'Roll Number', example: 'BA26-001.jpg' },
  { id: 'applicationNumber', label: 'Application Number', example: 'APP-2026-918.png' },
  { id: 'studentCode', label: 'Student Code', example: 'STU-001.jpg' },
  { id: 'enrollmentNumber', label: 'Registration Number', example: 'REG-2026-001.jpg' },
  {
    id: 'nehuRegistrationNumber',
    label: 'NEHU Registration Number',
    example: 'NEHU-2026-321.jpeg',
  },
  { id: 'studentId', label: 'Student ID', example: 'uuid.jpg' },
];

export function StudentPhotoBulkPage() {
  const session = useRequireAuth();
  const searchParams = useSearchParams();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [csvMap, setCsvMap] = useState('');
  const [identifierStrategy, setIdentifierStrategy] =
    useState<PhotoIdentifierStrategy>('rollNumber');
  const [conflictStrategy, setConflictStrategy] = useState<
    'REPLACE_EXISTING' | 'SKIP_EXISTING' | 'KEEP_BOTH'
  >('SKIP_EXISTING');
  const [duplicateStrategy, setDuplicateStrategy] = useState<
    'LATEST' | 'HIGHEST_RESOLUTION' | 'MANUAL'
  >('LATEST');
  const [cropMode, setCropMode] = useState<'COVER' | 'CONTAIN'>('COVER');
  const [normalization, setNormalization] = useState({
    ignoreExtension: true,
    ignoreSpaces: true,
    ignoreCase: true,
    stripSpecialCharacters: false,
  });
  const selectedStudentIds = useMemo(() => {
    const raw = searchParams.get('studentIds');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);
  const [filters, setFilters] = useState<DirectoryFilters>(() => ({
    ...emptyFilters,
    programVersionId: searchParams.get('programVersionId') ?? '',
    batchId: searchParams.get('batchId') ?? '',
    shiftId: searchParams.get('shiftId') ?? '',
    semester: searchParams.get('semester') ?? '',
  }));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preview, setPreview] = useState<PhotoBulkBatch | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [message, setMessage] = useState('');

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';
  const campuses = useQuery({
    queryKey: ['org', 'campuses', institutionId],
    queryFn: () => fetchCampuses(institutionId || undefined),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const campusId = campuses.data?.[0]?.id ?? '';
  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });
  const batches = useQuery({
    queryKey: ['batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const shifts = useQuery({
    queryKey: ['shifts', campusId],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(campusId),
  });
  const streams = useQuery({
    queryKey: ['streams'],
    queryFn: () => fetchAcademicStreams(),
    enabled: Boolean(session),
  });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: Boolean(session),
  });
  const sessions = useQuery({
    queryKey: ['sessions', institutionId],
    queryFn: () => listAcademicSessions(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const categories = useQuery({
    queryKey: ['lookups', 'CATEGORY'],
    queryFn: () => fetchMasterLookups('CATEGORY'),
    enabled: Boolean(session),
  });
  const religions = useQuery({
    queryKey: ['lookups', 'RELIGION'],
    queryFn: () => fetchMasterLookups('RELIGION'),
    enabled: Boolean(session),
  });
  const jobs = useQuery({
    queryKey: ['student-photo-bulk', 'jobs'],
    queryFn: fetchStudentPhotoBulkJobs,
    enabled: Boolean(session) && perms.canManagePhotos,
  });

  const programOptions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) rows.push({ id: v.id, label: `${p.code} v${v.version}` });
    }
    return rows;
  }, [programs.data]);

  const batchOptions = (batches.data ?? []).map((b) => ({
    id: b.id,
    label: `${b.batchCode} (${b.admissionYear})`,
  }));
  const shiftOptions = toShiftOptions(shifts.data ?? []);
  const streamOptions = (streams.data ?? []).map((s) => ({ id: s.id, label: s.name }));
  const departmentOptions = (departments.data ?? []).map((d) => ({ id: d.id, label: d.name }));
  const sessionOptions = ((sessions.data ?? []) as { id: string; name: string }[]).map((s) => ({
    id: s.id,
    label: s.name,
  }));
  const categoryOptions = (categories.data ?? []).map((c) => ({ id: c.id, label: c.label }));
  const religionOptions = (religions.data ?? []).map((r) => ({ id: r.id, label: r.label }));

  const previewMut = useMutation({
    mutationFn: () =>
      previewStudentPhotoBulkUpload(
        files,
        {
          identifierStrategy,
          uploadMode: files.some((f) => f.name.toLowerCase().endsWith('.zip'))
            ? 'ZIP'
            : csvMap.trim()
              ? 'CSV'
              : 'FILES',
          normalization,
          scopeFilter: {
            ...buildPhotoScopeFilter(filters),
            ids: selectedStudentIds.length ? selectedStudentIds.join(',') : undefined,
          },
          conflictStrategy,
          duplicateStrategy,
          cropMode,
          csvMap: csvMap.trim() || undefined,
        },
        setUploadPct,
      ),
    onSuccess: (data) => {
      setPreview(data);
      setMessage('Preview generated. Review matches before applying.');
      void qc.invalidateQueries({ queryKey: ['student-photo-bulk', 'jobs'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Photo preview failed')),
  });

  const applyMut = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('Generate preview first');
      return applyStudentPhotoBulkUpload(preview.id, conflictStrategy);
    },
    onSuccess: (result) => {
      setMessage(
        result.message ??
          `Assigned ${result.assigned ?? 0} photos. Skipped ${result.skipped ?? 0}.`,
      );
      void qc.invalidateQueries({ queryKey: ['student-photo-bulk', 'jobs'] });
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Photo assignment failed')),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteStudentPhotosBulk({ filter: buildPhotoScopeFilter(filters) }),
    onSuccess: (result) => {
      setMessage(`Deleted ${result.deleted} photos for matching students.`);
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Bulk delete failed')),
  });

  const reprocessMut = useMutation({
    mutationFn: () => reprocessStudentPhotosBulk({ filter: buildPhotoScopeFilter(filters) }),
    onSuccess: (result) => {
      setMessage(`Reprocessed ${result.reprocessed} photos. ${result.errors} errors.`);
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Bulk reprocess failed')),
  });

  if (!session) return null;

  if (!perms.canManagePhotos) {
    return (
      <DashboardShell role="admin" title="Bulk Photo Upload">
        <p className="text-sm text-muted-foreground">
          You do not have permission to manage student photos.
        </p>
      </DashboardShell>
    );
  }

  const selectedOption =
    identifierOptions.find((o) => o.id === identifierStrategy) ?? identifierOptions[0];
  const changes = preview?.changes ?? [];

  return (
    <DashboardShell role="admin" title="Student Photo Management">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Bulk upload, validate, preview, and assign profile photos.
            {selectedStudentIds.length
              ? ` ${selectedStudentIds.length} students selected from directory.`
              : ''}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => downloadStudentPhotoIdentifierList(filters, identifierStrategy)}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Identifier CSV
            </Button>
            <Link
              href="/admin/students"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Student directory
            </Link>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div
              className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFiles(Array.from(e.dataTransfer.files));
                setPreview(null);
              }}
            >
              <UploadCloud className="mx-auto mb-2 h-8 w-8 text-primary" />
              <h2 className="text-sm font-semibold">Drop photos or ZIP here</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports JPG, PNG, WEBP and ZIP folders. Naming format: {selectedOption.example}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <label className={cn(buttonVariants({ size: 'sm' }), 'cursor-pointer')}>
                  <ImagePlus className="mr-1 h-3.5 w-3.5" /> Browse files
                  <input
                    className="sr-only"
                    type="file"
                    multiple
                    accept="image/*,.zip"
                    onChange={(e) => {
                      setFiles(Array.from(e.target.files ?? []));
                      setPreview(null);
                    }}
                  />
                </label>
                <label
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'cursor-pointer',
                  )}
                >
                  <FileArchive className="mr-1 h-3.5 w-3.5" /> Browse folder
                  <input
                    className="sr-only"
                    type="file"
                    multiple
                    accept="image/*"
                    ref={(input) => {
                      if (input) {
                        input.setAttribute('webkitdirectory', '');
                        input.setAttribute('directory', '');
                      }
                    }}
                    onChange={(e) => {
                      setFiles(Array.from(e.target.files ?? []));
                      setPreview(null);
                    }}
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-primary">
                {files.length} file{files.length === 1 ? '' : 's'} detected
              </p>
              {previewMut.isPending ? (
                <p className="mt-1 text-xs text-muted-foreground">Uploading {uploadPct}%</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Match photos using">
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={identifierStrategy}
                  onChange={(e) => setIdentifierStrategy(e.target.value as PhotoIdentifierStrategy)}
                >
                  {identifierOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Existing photo conflict">
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={conflictStrategy}
                  onChange={(e) => setConflictStrategy(e.target.value as typeof conflictStrategy)}
                >
                  <option value="SKIP_EXISTING">Skip existing</option>
                  <option value="REPLACE_EXISTING">Replace existing</option>
                  <option value="KEEP_BOTH">Keep both versions</option>
                </select>
              </Field>
              <Field label="Duplicate filenames">
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={duplicateStrategy}
                  onChange={(e) => setDuplicateStrategy(e.target.value as typeof duplicateStrategy)}
                >
                  <option value="LATEST">Use latest</option>
                  <option value="HIGHEST_RESOLUTION">Use highest resolution</option>
                  <option value="MANUAL">Mark for manual review</option>
                </select>
              </Field>
              <Field label="Image fit">
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={cropMode}
                  onChange={(e) => setCropMode(e.target.value as typeof cropMode)}
                >
                  <option value="COVER">Center crop</option>
                  <option value="CONTAIN">Contain</option>
                </select>
              </Field>
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold">Normalization</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAdvancedOpen(true)}
                >
                  Scope filters
                </Button>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(normalization).map(([key, value]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setNormalization((n) => ({ ...n, [key]: e.target.checked }))}
                    />
                    {key.replace(/([A-Z])/g, ' $1')}
                  </label>
                ))}
              </div>
            </div>

            <Field label="CSV mapping (optional: StudentIdentifier,PhotoFile)">
              <textarea
                className="min-h-[88px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={csvMap}
                onChange={(e) => setCsvMap(e.target.value)}
                placeholder={'StudentIdentifier,PhotoFile\nBA26-001,photo1.jpg'}
              />
            </Field>

            {message ? <p className="rounded-lg bg-muted px-3 py-2 text-xs">{message}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={files.length === 0 || previewMut.isPending}
                onClick={() => previewMut.mutate()}
              >
                {previewMut.isPending ? 'Generating preview�' : 'Validate & Preview'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!preview || applyMut.isPending}
                onClick={() => applyMut.mutate()}
              >
                {applyMut.isPending ? 'Assigning�' : 'Upload & Assign Photos'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!perms.canDeletePhotos || deleteMut.isPending}
                onClick={() => deleteMut.mutate()}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Bulk delete by filters
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!perms.canReplacePhotos || reprocessMut.isPending}
                onClick={() => reprocessMut.mutate()}
              >
                Bulk reprocess images
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Job progress</h2>
            {(jobs.data ?? []).slice(0, 8).map((job) => (
              <div key={job.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{job.status}</span>
                  <span className="text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Matched {job.matchedCount} · Assigned {job.assignedCount} · Errors{' '}
                  {job.errorCount}
                </div>
                <button
                  type="button"
                  className="mt-1 text-primary underline"
                  onClick={() => downloadStudentPhotoBulkReport(job.id)}
                >
                  Download report
                </button>
              </div>
            ))}
            {(jobs.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No photo batches yet.</p>
            ) : null}
          </section>
        </div>

        {preview ? (
          <section className="rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Preview</h2>
                <p className="text-xs text-muted-foreground">
                  Matched {preview.matchedCount} · Unmatched {preview.unmatchedCount} · Duplicates{' '}
                  {preview.duplicateCount} · Missing {preview.missingCount}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => downloadStudentPhotoBulkReport(preview.id)}
              >
                Report
              </Button>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th className="px-2 py-2">New</th>
                    <th className="px-2 py-2">Old</th>
                    <th className="px-2 py-2">File</th>
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">Identifier</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((row) => (
                    <tr key={row.id} className="border-t border-border/60 align-top">
                      <td className="px-2 py-2">
                        <PhotoThumb path={row.thumbnailPath ?? row.stagedPath} />
                      </td>
                      <td className="px-2 py-2">
                        <PhotoThumb path={row.oldPhotoPath} muted />
                      </td>
                      <td className="px-2 py-2">
                        {row.fileName}
                        <div className="text-muted-foreground">
                          {row.width}x{row.height}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {row.student?.masterProfile?.fullName ?? '—'}
                        <div className="text-muted-foreground">
                          {row.student?.rollNumber ?? row.student?.enrollmentNumber ?? '—'}
                        </div>
                      </td>
                      <td className="px-2 py-2">{row.identifier ?? '—'}</td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5',
                            row.status === 'MATCHED'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : row.status === 'ERROR' || row.status === 'UNMATCHED'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-amber-500/10 text-amber-700',
                          )}
                        >
                          {row.status}
                        </span>
                        {row.errorMessage ? (
                          <div className="mt-1 text-destructive">{row.errorMessage}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>

      <DirectoryAdvancedFiltersDrawer
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        streamOptions={streamOptions}
        departmentOptions={departmentOptions}
        sessionOptions={sessionOptions}
        categoryOptions={categoryOptions}
        religionOptions={religionOptions}
      />
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs font-medium">
      <span className="block">{label}</span>
      {children}
    </label>
  );
}

function PhotoThumb({ path, muted }: { path?: string | null; muted?: boolean }) {
  const src = resolveUploadAssetUrl(path);
  return src ? (
    <img
      src={src}
      alt=""
      className={cn('h-12 w-12 rounded-md object-cover', muted && 'opacity-70')}
    />
  ) : (
    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
      None
    </div>
  );
}
