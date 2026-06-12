'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  addPoolCourse,
  createCategoryPool,
  deleteCategoryPool,
  fetchCategoryPool,
  removePoolCourse,
  updateCategoryPool,
} from '@/services/academic-engine';
import { fetchAllCourses, fetchCourses } from '@/services/programs';
import { apiErrorMessage } from '@/utils/api-error';
import { POOL_CATEGORY_TABS } from './pool-types';

type PoolEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolId?: string | null;
  institutionId: string;
  defaultCategory: string;
  onSaved?: () => void;
};

export function PoolEditorDialog({
  open,
  onOpenChange,
  poolId,
  institutionId,
  defaultCategory,
  onSaved,
}: PoolEditorDialogProps) {
  const qc = useQueryClient();
  const isEdit = Boolean(poolId);
  const [poolName, setPoolName] = useState('');
  const [semesterNo, setSemesterNo] = useState(1);
  const [categoryType, setCategoryType] = useState(defaultCategory);
  const [active, setActive] = useState(true);
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

  const poolQuery = useQuery({
    queryKey: ['academic-engine', 'category-pool', poolId],
    queryFn: () => fetchCategoryPool(poolId!),
    enabled: open && Boolean(poolId),
  });

  const coursesQuery = useQuery({
    queryKey: ['catalog', 'courses', 'pool-picker', courseSearch],
    queryFn: async () => {
      const term = courseSearch.trim();
      if (term) {
        return fetchCourses({ page: 1, limit: 100, search: term });
      }
      return fetchAllCourses();
    },
    enabled: open && isEdit,
  });

  useEffect(() => {
    if (!open) {
      setCourseSearch('');
      setSelectedCourseId('');
      setSaveError(null);
      setCourseError(null);
      return;
    }
    if (poolQuery.data) {
      setPoolName(poolQuery.data.poolName);
      setSemesterNo(poolQuery.data.semesterNo);
      setCategoryType(poolQuery.data.categoryType);
      setActive(poolQuery.data.active);
      setCourseSearch(poolQuery.data.categoryType);
      return;
    }
    if (!poolId) {
      setPoolName('');
      setSemesterNo(1);
      setCategoryType(defaultCategory);
      setActive(true);
      setSelectedCourseId('');
      setCourseSearch('');
    }
  }, [open, poolId, poolQuery.data, defaultCategory]);

  const savePoolMut = useMutation({
    mutationFn: async () => {
      const payload = {
        poolName,
        semesterNo,
        categoryType,
        active,
      };
      if (isEdit && poolId) {
        return updateCategoryPool(poolId, payload);
      }
      return createCategoryPool({
        ...payload,
        institutionId,
      });
    },
    onSuccess: () => {
      setSaveError(null);
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'category-pools'] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      setSaveError(apiErrorMessage(error, 'Could not save pool'));
    },
  });

  const addCourseMut = useMutation({
    mutationFn: () => addPoolCourse(poolId!, { courseId: selectedCourseId }),
    onSuccess: () => {
      setCourseError(null);
      setSelectedCourseId('');
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'category-pool', poolId] });
      onSaved?.();
    },
    onError: (error) => {
      setCourseError(apiErrorMessage(error, 'Could not add course'));
    },
  });

  const removeCourseMut = useMutation({
    mutationFn: (courseId: string) => removePoolCourse(poolId!, courseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'category-pool', poolId] });
      onSaved?.();
    },
  });

  const deletePoolMut = useMutation({
    mutationFn: () => deleteCategoryPool(poolId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'category-pools'] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      window.alert(apiErrorMessage(error, 'Could not delete pool'));
    },
  });

  const confirmDeletePool = () => {
    const pool = poolQuery.data;
    if (!pool) return;
    const courses = pool.courses?.length ?? 0;
    const assignments = pool.assignments?.length ?? pool._count?.assignments ?? 0;
    const details =
      courses > 0 || assignments > 0
        ? `\n\nThis removes ${courses} course(s) from the pool, unassigns ${assignments} programme(s), and deletes canonical pool offerings.`
        : '';
    if (confirm(`Delete "${pool.poolName}"?${details}\n\nThis cannot be undone.`)) {
      deletePoolMut.mutate();
    }
  };

  const poolCourses = poolQuery.data?.courses ?? [];
  const poolCourseIds = new Set(poolCourses.map((row) => row.courseId));
  const pickerCourses = (coursesQuery.data?.data ?? []).filter(
    (course) => !poolCourseIds.has(course.id),
  );
  const pickerTotal = coursesQuery.data?.meta.total ?? pickerCourses.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit category pool' : 'Create category pool'}</DialogTitle>
          <DialogDescription>
            Add courses once; canonical offerings and shared sections apply to all assigned
            programmes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {saveError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {saveError}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pool name</label>
              <Input
                className="mt-1 h-9"
                value={poolName}
                onChange={(e) => {
                  setPoolName(e.target.value);
                  setSaveError(null);
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Semester</label>
              <Input
                type="number"
                min={1}
                className="mt-1 h-9"
                value={semesterNo}
                onChange={(e) => setSemesterNo(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                value={categoryType}
                onChange={(e) => setCategoryType(e.target.value)}
                disabled={isEdit}
              >
                {POOL_CATEGORY_TABS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-1 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
          </div>

          {isEdit ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pool courses</p>
              {courseError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {courseError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Input
                  className="h-9 max-w-xs"
                  placeholder={`Search courses (e.g. ${categoryType})…`}
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                />
                <select
                  className="h-9 min-w-[200px] rounded-md border border-border bg-card px-2 text-sm"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  <option value="">Select course</option>
                  {pickerCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} — {course.title}
                    </option>
                  ))}
                </select>
                {coursesQuery.isLoading ? (
                  <p className="w-full text-xs text-muted-foreground">Loading courses…</p>
                ) : (
                  <p className="w-full text-xs text-muted-foreground">
                    {courseSearch.trim()
                      ? `${pickerCourses.length} match(es)`
                      : `${pickerCourses.length} of ${pickerTotal} courses in catalog`}
                    {pickerCourses.length === 0 ? ' — try a different search' : ''}
                  </p>
                )}
                <Button
                  size="sm"
                  disabled={!selectedCourseId || addCourseMut.isPending}
                  onClick={() => addCourseMut.mutate()}
                >
                  Add course
                </Button>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {poolCourses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No courses in pool yet.</p>
                ) : (
                  poolCourses.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-2 text-xs">
                      <span>
                        {row.course.code} — {row.course.title}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={removeCourseMut.isPending}
                        onClick={() => removeCourseMut.mutate(row.courseId)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {poolQuery.data?.offerings?.length ? (
                <p className="text-xs text-muted-foreground">
                  {poolQuery.data.offerings.length} canonical offering(s). Day · Section A is
                  created automatically when you add a course. Use Academic Engine → Offerings to
                  bulk-provision sections for older pool courses.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-between gap-2">
            {isEdit ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={deletePoolMut.isPending}
                onClick={confirmDeletePool}
              >
                {deletePoolMut.isPending ? 'Deleting…' : 'Delete pool'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!poolName.trim() || savePoolMut.isPending}
                onClick={() => savePoolMut.mutate()}
              >
                {savePoolMut.isPending ? 'Saving…' : isEdit ? 'Update pool' : 'Create pool'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
