'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DataTable } from '@/components/erp/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchShifts } from '@/services/academic-engine';
import {
  autoDivideSubjectSections,
  bulkProvisionSubjectSections,
  createSubjectSection,
  fetchSubjectSectionDashboard,
  fetchSubjectsWithSections,
  importSectionAllocations,
  type SectionAllocationStrategy,
  type SubjectWithSections,
} from '@/services/subject-sections';

const CATEGORIES = ['AEC', 'SEC', 'MDC', 'VAC', 'VTC', 'MAJOR', 'MINOR'];

export default function SubjectSectionsPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [semesterNo, setSemesterNo] = useState('1');
  const [category, setCategory] = useState('AEC');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [selectedOffering, setSelectedOffering] = useState<SubjectWithSections | null>(null);
  const [sectionCodes, setSectionCodes] = useState('A,B');
  const [capacity, setCapacity] = useState('120');
  const [strategy, setStrategy] = useState<SectionAllocationStrategy>('ROLL_NUMBER');
  const [importText, setImportText] = useState('');

  const filters = useMemo(
    () => ({
      semesterNo: Number(semesterNo) || 1,
      category: category || undefined,
      search: search.trim() || undefined,
    }),
    [semesterNo, category, search],
  );

  const dashboard = useQuery({
    queryKey: ['subject-sections', 'dashboard', filters],
    queryFn: () => fetchSubjectSectionDashboard(filters),
    enabled: Boolean(session),
  });

  const subjects = useQuery({
    queryKey: ['subject-sections', 'subjects', filters],
    queryFn: () => fetchSubjectsWithSections(filters),
    enabled: Boolean(session),
  });

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts'],
    queryFn: fetchShifts,
    enabled: Boolean(session),
  });

  const dayShiftId = shifts.data?.find((s) => s.code === 'DAY')?.id ?? shifts.data?.[0]?.id ?? '';

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['subject-sections'] });
  };

  const bulkProvisionMut = useMutation({
    mutationFn: () =>
      bulkProvisionSubjectSections({
        semesterNo: Number(semesterNo) || 1,
        categories: category ? [category] : ['AEC', 'SEC', 'MDC', 'VAC', 'VTC'],
        sectionCodes: sectionCodes
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        capacityPerSection: Number(capacity) || 120,
        shiftCode: 'DAY',
      }),
    onSuccess: (result) => {
      setMessage(`Created ${result.created} section(s), ${result.skipped} already existed.`);
      invalidate();
    },
  });

  const addSectionMut = useMutation({
    mutationFn: (payload: { offeringId: string; sectionCode: string }) =>
      createSubjectSection({
        offeringId: payload.offeringId,
        shiftId: dayShiftId,
        sectionCode: payload.sectionCode,
        capacity: Number(capacity) || 120,
      }),
    onSuccess: () => {
      setMessage('Section created.');
      invalidate();
    },
  });

  const autoDivideMut = useMutation({
    mutationFn: (offeringId: string) =>
      autoDivideSubjectSections({
        offeringId,
        shiftId: dayShiftId || undefined,
        strategy,
      }),
    onSuccess: (result) => {
      setMessage(
        `Auto-divided ${result.assigned} student(s) across ${result.sections} section(s).`,
      );
      invalidate();
    },
  });

  const importMut = useMutation({
    mutationFn: () => {
      if (!selectedOffering) throw new Error('Select a subject first');
      const rows = importText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [rollNumber, sectionCode] = line.split(/[,\t]/).map((p) => p.trim());
          return { rollNumber: rollNumber ?? '', sectionCode: sectionCode ?? '' };
        })
        .filter((r) => r.rollNumber && r.sectionCode);
      return importSectionAllocations({
        offeringId: selectedOffering.id,
        shiftId: dayShiftId || undefined,
        rows,
      });
    },
    onSuccess: (result) => {
      setMessage(`Imported ${result.imported} allocation(s), ${result.failed} failed.`);
      invalidate();
    },
  });

  return (
    <DashboardShell
      title="Subject Sections"
      description="Split compulsory papers (AEC, SEC, MDC, etc.) into classroom sections A, B, C — independent from the student's official class section."
    >
      <div className="space-y-4">
        {message ? (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            {message}
          </p>
        ) : null}
        {dashboard.isError || subjects.isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Could not load subject sections. Refresh the page after the API reloads.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Total subjects', dashboard.data?.totalSubjects ?? '—'],
            ['Multi-section subjects', dashboard.data?.subjectsWithMultipleSections ?? '—'],
            ['Total sections', dashboard.data?.totalSections ?? '—'],
            ['Students allocated', dashboard.data?.studentsAllocated ?? '—'],
            ['Pending allocation', dashboard.data?.pendingAllocation ?? '—'],
          ].map(([label, value]) => (
            <CompactCard key={label}>
              <CompactCardBody className="py-3">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold tabular-nums">{value}</p>
              </CompactCardBody>
            </CompactCard>
          ))}
        </div>

        <CompactCard>
          <CompactCardHeader title="Filters & bulk setup" />
          <CompactCardBody className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={semesterNo}
                onChange={(e) => setSemesterNo(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={String(n)}>
                    Semester {n}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input
                className="h-9 w-48"
                placeholder="Search course code/title"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input
                className="h-9 w-28"
                placeholder="Sections A,B"
                value={sectionCodes}
                onChange={(e) => setSectionCodes(e.target.value)}
              />
              <Input
                className="h-9 w-24"
                placeholder="Capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
              <Button
                size="sm"
                disabled={bulkProvisionMut.isPending}
                onClick={() => bulkProvisionMut.mutate()}
              >
                {bulkProvisionMut.isPending ? 'Creating…' : `Create ${category} sections`}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Bulk create Section A & B (or C) for all {category} papers in Semester {semesterNo}.
              Students stay on their programme class section; this only splits instructional groups
              per subject.
            </p>
          </CompactCardBody>
        </CompactCard>

        <CompactCard className="min-w-0">
          <CompactCardHeader title="Subjects & sections" />
          <CompactCardBody className="space-y-4 p-0 sm:p-0">
            <DataTable
              rows={subjects.data ?? []}
              getRowKey={(r) => r.id}
              columns={[
                {
                  key: 'course',
                  header: 'Subject',
                  cell: (r) => (
                    <div>
                      <p className="font-medium">{r.course.code}</p>
                      <p className="text-[11px] text-muted-foreground">{r.course.title}</p>
                    </div>
                  ),
                },
                { key: 'cat', header: 'Category', cell: (r) => r.category },
                { key: 'sem', header: 'Sem', cell: (r) => r.semesterSequence },
                { key: 'sections', header: 'Sections', cell: (r) => r.sectionCount },
                { key: 'allocated', header: 'Allocated', cell: (r) => r.totalAllocated },
                {
                  key: 'detail',
                  header: 'Section breakdown',
                  cell: (r) => (
                    <div className="flex flex-wrap gap-1">
                      {r.sections.map((s) => (
                        <span
                          key={s.id}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            s.isFull
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {s.sectionCode}: {s.allocated}/{s.capacity}
                        </span>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  cell: (r) => (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          setSelectedOffering(r);
                          const next = r.sections.length
                            ? String.fromCharCode(
                                65 +
                                  Math.max(
                                    ...r.sections.map((s) => s.sectionCode.charCodeAt(0) - 65),
                                  ) +
                                  1,
                              )
                            : 'B';
                          addSectionMut.mutate({ offeringId: r.id, sectionCode: next });
                        }}
                      >
                        + Section
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={r.sectionCount < 2 || autoDivideMut.isPending}
                        onClick={() => autoDivideMut.mutate(r.id)}
                      >
                        Auto divide
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={() => setSelectedOffering(r)}
                      >
                        Import
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Allocate students"
            description={
              selectedOffering
                ? `${selectedOffering.course.code} — ${selectedOffering.course.title}`
                : 'Select a subject from the table to import roll → section mappings'
            }
          />
          <CompactCardBody className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as SectionAllocationStrategy)}
              >
                <option value="ROLL_NUMBER">By roll number</option>
                <option value="ALPHABET">By name (A–M / N–Z style split)</option>
                <option value="GENDER">By gender, then roll</option>
                <option value="EQUAL">Equal round-robin</option>
                <option value="RANDOM">Random</option>
              </select>
            </div>
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              placeholder={'Roll Number, Section\nBA26-001, A\nBA26-002, B\nBA26-003, A'}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!selectedOffering || importMut.isPending || !importText.trim()}
              onClick={() => importMut.mutate()}
            >
              {importMut.isPending ? 'Importing…' : 'Import section allocation'}
            </Button>
          </CompactCardBody>
        </CompactCard>
      </div>
    </DashboardShell>
  );
}
