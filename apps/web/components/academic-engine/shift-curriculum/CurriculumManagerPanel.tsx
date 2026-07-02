'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, Settings2 } from 'lucide-react';

import { PoolEditorDialog } from '@/components/academic-engine/category-pools/PoolEditorDialog';
import { CourseEligibilityPanel } from '@/components/programs/course-eligibility/course-eligibility-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  assignCurriculumManagerPool,
  fetchCurriculumManagerView,
  fetchShiftProgrammes,
  fetchShifts,
  upsertShiftCurriculumPolicy,
} from '@/services/academic-engine';
import { fetchInstitutions } from '@/services/organization';
import type {
  CurriculumManagerCategoryBlock,
  CurriculumManagerView,
} from '@/services/academic-engine';
import type { Course } from '@/types/programs';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  institutionId?: string;
  initialShiftId?: string;
};

const SEMESTERS = [1, 2, 3, 4, 5, 6] as const;

function statusBadge(status: CurriculumManagerView['configurationStatus']) {
  if (status === 'complete') {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Configured</Badge>;
  }
  if (status === 'partial') {
    return <Badge variant="secondary">Partial</Badge>;
  }
  return <Badge variant="outline">Not configured</Badge>;
}

export function CurriculumManagerPanel({ institutionId, initialShiftId }: Props) {
  const qc = useQueryClient();
  const [shiftId, setShiftId] = useState(initialShiftId ?? '');
  const [programVersionId, setProgramVersionId] = useState('');
  const [semesterNo, setSemesterNo] = useState<number>(3);
  const [poolEditorId, setPoolEditorId] = useState<string | null>(null);
  const [eligibilityCourse, setEligibilityCourse] = useState<Course | null>(null);
  const [notice, setNotice] = useState('');

  const institutions = useQuery({
    queryKey: ['organization', 'institutions'],
    queryFn: fetchInstitutions,
  });
  const resolvedInstitutionId = institutionId ?? institutions.data?.[0]?.id ?? '';

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts', 'ACTIVE'],
    queryFn: () => fetchShifts(),
  });

  const activeShifts = useMemo(
    () => (shifts.data ?? []).filter((shift) => shift.status === 'ACTIVE'),
    [shifts.data],
  );

  const selectedShiftId = shiftId || activeShifts[0]?.id || '';

  const programmes = useQuery({
    queryKey: ['shift-curriculum', 'programmes', selectedShiftId, resolvedInstitutionId],
    queryFn: () => fetchShiftProgrammes(selectedShiftId, resolvedInstitutionId),
    enabled: Boolean(selectedShiftId),
  });

  const enabledProgrammes = useMemo(
    () => (programmes.data ?? []).filter((programme) => programme.enabled),
    [programmes.data],
  );

  const selectedProgramVersionId =
    programVersionId || enabledProgrammes[0]?.publishedVersionIds[0] || '';

  const curriculum = useQuery({
    queryKey: [
      'curriculum-manager',
      selectedShiftId,
      selectedProgramVersionId,
      semesterNo,
      resolvedInstitutionId,
    ],
    queryFn: () =>
      fetchCurriculumManagerView({
        shiftId: selectedShiftId,
        programVersionId: selectedProgramVersionId,
        semesterNo,
        institutionId: resolvedInstitutionId || undefined,
      }),
    enabled: Boolean(selectedShiftId && selectedProgramVersionId),
  });

  const assignPoolMut = useMutation({
    mutationFn: (poolId: string) =>
      assignCurriculumManagerPool(selectedShiftId, {
        programVersionId: selectedProgramVersionId,
        semesterNo,
        poolId,
      }),
    onSuccess: (data) => {
      setNotice('');
      qc.setQueryData(
        [
          'curriculum-manager',
          selectedShiftId,
          selectedProgramVersionId,
          semesterNo,
          resolvedInstitutionId,
        ],
        data,
      );
      void qc.invalidateQueries({ queryKey: ['shift-curriculum', 'configuration-status'] });
    },
    onError: (error) => {
      setNotice(apiErrorMessage(error, 'Could not assign pool'));
    },
  });

  const autoAssignMut = useMutation({
    mutationFn: (input: { categoryType: string; autoAssign: boolean }) =>
      upsertShiftCurriculumPolicy(selectedShiftId, {
        programVersionId: selectedProgramVersionId,
        semesterNo,
        categoryType: input.categoryType,
        autoAssign: input.autoAssign,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['curriculum-manager', selectedShiftId, selectedProgramVersionId, semesterNo],
      });
    },
    onError: (error) => {
      setNotice(apiErrorMessage(error, 'Could not update auto-assign policy'));
    },
  });

  const view = curriculum.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Curriculum Manager
          </CardTitle>
          <CardDescription>
            Configure shift-wise semester pools, compulsory auto-assign papers, and MDC eligibility
            rules. Course Master stays global — you map existing NEHU papers to each shift here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium">
            Shift
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={selectedShiftId}
              onChange={(event) => setShiftId(event.target.value)}
            >
              {activeShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.code} — {shift.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Programme
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={selectedProgramVersionId}
              onChange={(event) => setProgramVersionId(event.target.value)}
              disabled={programmes.isLoading}
            >
              {enabledProgrammes.map((programme) => (
                <option
                  key={programme.programId}
                  value={programme.publishedVersionIds[0] ?? ''}
                  disabled={!programme.publishedVersionIds[0]}
                >
                  {programme.code} — {programme.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Semester
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={semesterNo}
              onChange={(event) => setSemesterNo(Number(event.target.value))}
            >
              {SEMESTERS.map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      {notice ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {notice}
        </p>
      ) : null}

      {curriculum.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading curriculum…</p>
      ) : null}

      {curriculum.isError ? (
        <p className="text-sm text-destructive">
          {apiErrorMessage(curriculum.error, 'Could not load curriculum manager view')}
        </p>
      ) : null}

      {view ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>
                  {view.programVersion.code} · Semester {view.semesterNo} · {view.shift.code}
                </CardTitle>
                <CardDescription>{view.semesterSummary}</CardDescription>
              </div>
              {statusBadge(view.configurationStatus)}
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {view.missingCategories.length ? (
                <p>
                  Missing pool assignments:{' '}
                  <span className="font-medium text-foreground">
                    {view.missingCategories.join(', ')}
                  </span>
                </p>
              ) : (
                <p>All required elective pools are assigned for this shift and semester.</p>
              )}
              {!view.minorEnabled ? (
                <p>
                  Minor is not part of this semester structure (stored on profile for later
                  semesters).
                </p>
              ) : null}
              {view.shiftIndependent ? (
                <p>
                  This semester uses programme direct mappings — identical for Morning and Day
                  shifts.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {view.majorDepartments.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" />
                  Major / Core papers
                </CardTitle>
                <CardDescription>
                  Direct programme mappings — assigned automatically from the student&apos;s Major
                  Department during registration and import.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="px-2 py-2 font-medium">Department</th>
                      {view.majorDepartments[0]?.papers.map((_, index) => (
                        <th key={index} className="px-2 py-2 font-medium">
                          Paper {index + 1}
                        </th>
                      ))}
                      {view.majorDepartments.some((row) => row.internship) ? (
                        <th className="px-2 py-2 font-medium">Internship</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {view.majorDepartments.map((department) => (
                      <tr key={department.departmentName} className="border-b border-border/40">
                        <td className="px-2 py-2 font-medium">{department.departmentName}</td>
                        {department.papers.map((paper) => (
                          <td key={paper.offeringId} className="px-2 py-2">
                            <span className="block">{paper.title}</span>
                            <span className="text-xs text-muted-foreground">{paper.code}</span>
                          </td>
                        ))}
                        {view.majorDepartments.some((row) => row.internship) ? (
                          <td className="px-2 py-2">
                            {department.internship ? (
                              <>
                                <span className="block">{department.internship.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {department.internship.code}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}

          {view.minorDepartments.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Minor papers (SUB-303)</CardTitle>
                <CardDescription>
                  Student selects Minor Department — ERP maps to the matching -303 paper
                  automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="px-2 py-2 font-medium">Minor Department</th>
                      <th className="px-2 py-2 font-medium">Paper</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.minorDepartments.map((department) => (
                      <tr key={department.departmentName} className="border-b border-border/40">
                        <td className="px-2 py-2 font-medium">{department.departmentName}</td>
                        <td className="px-2 py-2">
                          <span className="block">{department.paper.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {department.paper.code}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {view.categories.map((category) => (
              <CurriculumCategoryCard
                key={category.categoryType}
                category={category}
                assigning={assignPoolMut.isPending}
                autoAssignPending={autoAssignMut.isPending}
                onAssignPool={(poolId) => assignPoolMut.mutate(poolId)}
                onToggleAutoAssign={(checked) =>
                  autoAssignMut.mutate({
                    categoryType: category.categoryType,
                    autoAssign: checked,
                  })
                }
                onManagePool={(poolId) => setPoolEditorId(poolId)}
                onEditEligibility={(course) =>
                  setEligibilityCourse({
                    id: course.courseId,
                    code: course.code,
                    title: course.title,
                  } as Course)
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <PoolEditorDialog
        open={Boolean(poolEditorId)}
        onOpenChange={(open) => {
          if (!open) setPoolEditorId(null);
        }}
        poolId={poolEditorId}
        institutionId={resolvedInstitutionId}
        defaultCategory="MDC"
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ['curriculum-manager'] });
        }}
      />

      <Dialog
        open={Boolean(eligibilityCourse)}
        onOpenChange={(open) => {
          if (!open) setEligibilityCourse(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Eligibility rules</DialogTitle>
            <DialogDescription>
              Rules apply globally on the course — all shifts and semesters that use this paper
              inherit the same eligibility.
            </DialogDescription>
          </DialogHeader>
          {eligibilityCourse ? (
            <CourseEligibilityPanel course={eligibilityCourse} canManage />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CurriculumCategoryCard({
  category,
  assigning,
  autoAssignPending,
  onAssignPool,
  onToggleAutoAssign,
  onManagePool,
  onEditEligibility,
}: {
  category: CurriculumManagerCategoryBlock;
  assigning: boolean;
  autoAssignPending: boolean;
  onAssignPool: (poolId: string) => void;
  onToggleAutoAssign: (checked: boolean) => void;
  onManagePool: (poolId: string) => void;
  onEditEligibility: (course: CurriculumManagerCategoryBlock['courses'][number]) => void;
}) {
  const selectedPoolId = category.pool?.id ?? '';
  const isElectivePool = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'].includes(category.categoryType);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {category.categoryType}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                × {category.requiredCount}
              </span>
            </CardTitle>
            <CardDescription>
              {category.mandatory ? 'Mandatory' : 'Optional'}
              {category.continuityRule ? ` · ${category.continuityRule}` : ''}
            </CardDescription>
          </div>
          {category.autoAssign ? <Badge variant="secondary">Auto-assign</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isElectivePool ? (
          <>
            <label className="block text-sm font-medium">
              Assigned pool
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={selectedPoolId}
                disabled={assigning || !category.availablePools.length}
                onChange={(event) => {
                  if (event.target.value) onAssignPool(event.target.value);
                }}
              >
                <option value="">
                  {category.availablePools.length
                    ? 'Select pool…'
                    : 'No pools for this shift / semester'}
                </option>
                {category.availablePools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.poolName} ({pool.courseCount} papers)
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={category.autoAssign}
                disabled={autoAssignPending}
                onChange={(event) => onToggleAutoAssign(event.target.checked)}
              />
              Automatically assign when only one paper (or compulsory category)
            </label>

            {category.pool ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onManagePool(category.pool!.id)}
                >
                  Manage pool papers
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Major and minor papers are configured on the programme version directly, not via shared
            pools.
          </p>
        )}

        {category.courses.length ? (
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left">
                  <th className="px-3 py-2 font-medium">Paper</th>
                  <th className="px-3 py-2 font-medium">Eligibility</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {category.courses.map((course) => (
                  <tr key={course.courseId} className="border-b border-border/40">
                    <td className="px-3 py-2">
                      <span className="block">{course.title}</span>
                      <span className="text-xs text-muted-foreground">{course.code}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {course.eligibilitySummary}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditEligibility(course)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : category.pool ? (
          <p className="text-sm text-muted-foreground">Pool has no active courses yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
