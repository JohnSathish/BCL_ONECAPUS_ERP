'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { previewCourseEligibility } from '@/services/programs';
import { fetchStudents } from '@/services/students';
import type { CourseEligibilityPreviewResult } from '@/types/course-eligibility';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseCode: string;
};

export function EligibilityPreviewDialog({ open, onOpenChange, courseId, courseCode }: Props) {
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [result, setResult] = useState<CourseEligibilityPreviewResult | null>(null);

  const previewMut = useMutation({
    mutationFn: async (studentId: string) => previewCourseEligibility(courseId, { studentId }),
    onSuccess: (data) => setResult(data),
  });

  const searchMut = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetchStudents({ search: query, limit: 8 });
      return response.data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Test eligibility — {courseCode}</DialogTitle>
          <DialogDescription>
            Select a sample student to evaluate course rules and see why they are eligible or
            blocked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search student by name or enrollment no."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => searchMut.mutate(studentSearch)}
              disabled={!studentSearch.trim() || searchMut.isPending}
            >
              Search
            </Button>
          </div>

          {(searchMut.data ?? []).length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {searchMut.data?.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setSelectedStudentId(student.id);
                    previewMut.mutate(student.id);
                  }}
                >
                  {student.fullName} · {student.enrollmentNumber}
                </button>
              ))}
            </div>
          ) : null}

          {previewMut.isPending ? (
            <p className="text-sm text-muted-foreground">Evaluating…</p>
          ) : null}

          {result && selectedStudentId ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                result.eligible
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-destructive/40 bg-destructive/5 text-destructive'
              }`}
            >
              <p className="font-medium">{result.eligible ? 'Eligible' : 'Not eligible'}</p>
              {result.reasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {result.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">No blocking rules matched this student profile.</p>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
