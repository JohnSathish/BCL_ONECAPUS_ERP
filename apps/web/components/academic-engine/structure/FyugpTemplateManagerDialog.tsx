'use client';

import { useEffect, useMemo, useState } from 'react';
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
  createFyugpTemplate,
  createFyugpTemplateFromNehuDefaults,
  fetchFyugpTemplate,
  updateFyugpTemplate,
} from '@/services/academic-engine';
import { DEFAULT_SEMESTER_CREDIT_TARGET, STRUCTURE_CATEGORY_TYPES } from './structure-types';

function semesterLineTotals(lines: LineDraft[], semesterNo: number) {
  let papers = 0;
  let credits = 0;
  for (const line of lines.filter((row) => row.semesterNo === semesterNo)) {
    if (line.subjectCount <= 0) continue;
    papers += line.subjectCount;
    credits += line.subjectCount * (Number(line.creditRule) || 0);
  }
  return { papers, credits };
}

type FyugpTemplateManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string | null;
};

type LineDraft = {
  semesterNo: number;
  categoryType: string;
  subjectCount: number;
  continuityRule: string;
  creditRule: string;
  optionalFlag: boolean;
};

const EMPTY_LINE: LineDraft = {
  semesterNo: 1,
  categoryType: 'MAJOR',
  subjectCount: 0,
  continuityRule: '',
  creditRule: '',
  optionalFlag: false,
};

export function FyugpTemplateManagerDialog({
  open,
  onOpenChange,
  templateId,
}: FyugpTemplateManagerDialogProps) {
  const qc = useQueryClient();
  const isEdit = Boolean(templateId);
  const [templateName, setTemplateName] = useState('');
  const [regulationYear, setRegulationYear] = useState(2026);
  const [programmeLevel, setProgrammeLevel] = useState<'UG' | 'PG'>('UG');
  const [totalSemesters, setTotalSemesters] = useState(8);
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);

  const templateQuery = useQuery({
    queryKey: ['academic-engine', 'fyugp-template', templateId],
    queryFn: () => fetchFyugpTemplate(templateId!),
    enabled: open && Boolean(templateId),
  });

  useEffect(() => {
    if (!open) return;
    if (templateQuery.data) {
      setTemplateName(templateQuery.data.templateName);
      setRegulationYear(templateQuery.data.regulationYear);
      setProgrammeLevel(templateQuery.data.programmeLevel);
      setTotalSemesters(templateQuery.data.totalSemesters);
      setLines(
        (templateQuery.data.lines ?? []).map((line) => ({
          semesterNo: line.semesterNo,
          categoryType: line.categoryType,
          subjectCount: line.subjectCount,
          continuityRule: line.continuityRule ?? '',
          creditRule: line.creditRule != null ? String(line.creditRule) : '',
          optionalFlag: line.optionalFlag ?? false,
        })),
      );
      return;
    }
    if (!templateId) {
      setTemplateName('');
      setRegulationYear(2026);
      setProgrammeLevel('UG');
      setTotalSemesters(8);
      setLines([{ ...EMPTY_LINE }]);
    }
  }, [open, templateId, templateQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        templateName,
        regulationYear,
        programmeLevel,
        totalSemesters,
        lines: lines.map((line) => ({
          semesterNo: line.semesterNo,
          categoryType: line.categoryType,
          subjectCount: line.subjectCount,
          continuityRule: line.continuityRule || undefined,
          creditRule: line.creditRule ? Number(line.creditRule) : undefined,
          optionalFlag: line.optionalFlag,
        })),
      };
      if (isEdit && templateId) {
        return updateFyugpTemplate(templateId, payload);
      }
      return createFyugpTemplate(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'fyugp-templates'] });
      onOpenChange(false);
    },
  });

  const nehuMut = useMutation({
    mutationFn: createFyugpTemplateFromNehuDefaults,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'fyugp-templates'] });
      onOpenChange(false);
    },
  });

  const semesterOptions = useMemo(
    () => Array.from({ length: totalSemesters }, (_, index) => index + 1),
    [totalSemesters],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit FYUGP template' : 'Create FYUGP template'}</DialogTitle>
          <DialogDescription>
            Configure global semester category counts once and apply to multiple programmes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template name</label>
              <Input
                className="mt-1 h-9"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Regulation year</label>
              <Input
                type="number"
                className="mt-1 h-9"
                value={regulationYear}
                onChange={(e) => setRegulationYear(Number(e.target.value) || 2026)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Programme level</label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                value={programmeLevel}
                onChange={(e) => setProgrammeLevel(e.target.value as 'UG' | 'PG')}
              >
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Total semesters</label>
              <Input
                type="number"
                min={1}
                className="mt-1 h-9"
                value={totalSemesters}
                onChange={(e) => setTotalSemesters(Math.max(1, Number(e.target.value) || 8))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Template lines</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {semesterOptions.map((sem) => {
                  const totals = semesterLineTotals(lines, sem);
                  const valid = totals.credits === DEFAULT_SEMESTER_CREDIT_TARGET;
                  return (
                    <span
                      key={sem}
                      className={`rounded-md px-2 py-1 ${valid ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}
                    >
                      Sem {sem}: {totals.papers} papers · {totals.credits}/
                      {DEFAULT_SEMESTER_CREDIT_TARGET} cr
                    </span>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
              >
                Add line
              </Button>
            </div>
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-6"
              >
                <select
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs"
                  value={line.semesterNo}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, semesterNo: Number(e.target.value) } : row,
                      ),
                    )
                  }
                >
                  {semesterOptions.map((sem) => (
                    <option key={sem} value={sem}>
                      Sem {sem}
                    </option>
                  ))}
                </select>
                <select
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs"
                  value={line.categoryType}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, categoryType: e.target.value } : row,
                      ),
                    )
                  }
                >
                  {STRUCTURE_CATEGORY_TYPES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0}
                  className="h-8"
                  placeholder="Count"
                  value={line.subjectCount}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, subjectCount: Number(e.target.value) || 0 }
                          : row,
                      ),
                    )
                  }
                />
                <select
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs"
                  value={line.continuityRule}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, continuityRule: e.target.value } : row,
                      ),
                    )
                  }
                >
                  <option value="">Continuity —</option>
                  <option value="LOCK">Lock</option>
                  <option value="CHANGE_ALLOWED">Change allowed</option>
                </select>
                <Input
                  type="number"
                  min={0}
                  className="h-8"
                  placeholder="Credits"
                  value={line.creditRule}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, creditRule: e.target.value } : row,
                      ),
                    )
                  }
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={line.optionalFlag}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, optionalFlag: e.target.checked } : row,
                        ),
                      )
                    }
                  />
                  Optional
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            {!isEdit ? (
              <Button
                size="sm"
                variant="outline"
                disabled={nehuMut.isPending}
                onClick={() => nehuMut.mutate()}
              >
                {nehuMut.isPending ? 'Creating…' : 'Create from NEHU defaults'}
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
                disabled={!templateName.trim() || !lines.length || saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? 'Saving…' : isEdit ? 'Update template' : 'Create template'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
