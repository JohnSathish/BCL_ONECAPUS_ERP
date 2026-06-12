'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { ApiConnectivityBanner } from '@/components/erp/api-connectivity-banner';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { CompletionExportMenu } from '@/components/academic-engine/curriculum-completion/completion-export-menu';
import { CompletionFilterBar } from '@/components/academic-engine/curriculum-completion/completion-filter-bar';
import { CompletionMatrix } from '@/components/academic-engine/curriculum-completion/completion-matrix';
import { CompletionSummaryCards } from '@/components/academic-engine/curriculum-completion/completion-summary-cards';
import { MissingItemsPanel } from '@/components/academic-engine/curriculum-completion/missing-items-panel';
import { SharedPoolsAuditPanel } from '@/components/academic-engine/curriculum-completion/shared-pools-audit-panel';
import { useRequireAuth } from '@/hooks/use-auth';
import { useApiHealth } from '@/hooks/use-api-health';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import {
  exportCurriculumCompletion,
  fetchCurriculumCompletionMatrix,
  fetchCurriculumCompletionMissingItems,
  fetchCurriculumCompletionSummary,
  fetchSharedPoolsAudit,
} from '@/services/academic-engine';
import { fetchAcademicDepartments, fetchInstitutions } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import type { CellSelection, CompletionFilters } from '@/types/curriculum-completion';
import { completionFiltersToParams, emptyCompletionFilters } from '@/types/curriculum-completion';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

const ISSUE_FILTER_MAP = {
  missingMappings: undefined,
  unmappedCourses: 'MISSING_SECTION',
  sharedPoolsMissing: 'MISSING_POOL',
  pendingFacultyAssignment: 'MISSING_FACULTY',
} as const;

const lookupQueryOptions = {
  staleTime: 5 * 60_000,
} as const;

const completionQueryOptions = {
  staleTime: 30_000,
} as const;

export default function CurriculumCompletionPage() {
  const session = useRequireAuth();
  const [filters, setFilters] = useState<CompletionFilters>(emptyCompletionFilters);
  const [cellSelection, setCellSelection] = useState<CellSelection>(null);
  const [issueFilter, setIssueFilter] = useState<string | undefined>();

  const queryParams = useMemo(() => completionFiltersToParams(filters), [filters]);

  const apiHealth = useApiHealth(Boolean(session));

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
    ...lookupQueryOptions,
  });
  const institutionId = filters.institutionId || institutions.data?.[0]?.id || '';

  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: Boolean(session),
    ...lookupQueryOptions,
  });

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
    ...lookupQueryOptions,
  });

  const batches = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
    ...lookupQueryOptions,
  });

  const summaryQuery = useQuery({
    queryKey: ['academic-engine', 'curriculum-completion', 'summary', queryParams],
    queryFn: () => fetchCurriculumCompletionSummary(queryParams),
    enabled: Boolean(session) && apiHealth.isSuccess,
    ...completionQueryOptions,
  });

  const matrixQuery = useQuery({
    queryKey: ['academic-engine', 'curriculum-completion', 'matrix', queryParams],
    queryFn: () => fetchCurriculumCompletionMatrix(queryParams),
    enabled: Boolean(session) && apiHealth.isSuccess,
    ...completionQueryOptions,
  });

  const missingQuery = useQuery({
    queryKey: [
      'academic-engine',
      'curriculum-completion',
      'missing-items',
      queryParams,
      cellSelection,
      issueFilter,
    ],
    queryFn: () =>
      fetchCurriculumCompletionMissingItems({
        ...queryParams,
        ...(cellSelection
          ? {
              programVersionId: cellSelection.programVersionId,
              semesterSequence: cellSelection.semesterSequence,
              category: cellSelection.category,
            }
          : {}),
        issueType: issueFilter,
        limit: 50,
      }),
    enabled:
      Boolean(session) && apiHealth.isSuccess && (Boolean(cellSelection) || Boolean(issueFilter)),
    ...completionQueryOptions,
  });

  const poolAuditQuery = useQuery({
    queryKey: ['academic-engine', 'curriculum-completion', 'pools-audit', queryParams],
    queryFn: () => fetchSharedPoolsAudit(queryParams),
    enabled: Boolean(session) && apiHealth.isSuccess,
    ...completionQueryOptions,
  });

  const institutionOptions = useMemo(
    () =>
      (institutions.data ?? []).map((i) => ({
        id: i.id,
        label: i.code ? `${i.code} — ${i.name}` : i.name,
      })),
    [institutions.data],
  );

  const programmeOptions = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        list.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [programs.data]);

  const departmentOptions = useMemo(
    () =>
      (departments.data ?? []).map((d) => ({
        id: d.id,
        label: d.code ? `${d.code} — ${d.name}` : d.name,
      })),
    [departments.data],
  );

  const batchOptions = useMemo(
    () =>
      (batches.data ?? []).map((b) => ({
        id: b.id,
        label: b.batchCode ?? b.id.slice(0, 8),
      })),
    [batches.data],
  );

  const exportMut = useMutation({
    mutationFn: exportCurriculumCompletion,
    onSuccess: (blob, vars) => {
      const ext = vars.format === 'xlsx' ? 'xlsx' : 'csv';
      downloadBlob(blob, `curriculum-${vars.reportType}.${ext}`);
    },
  });

  const apiUnavailable =
    apiHealth.isError ||
    (apiHealth.isSuccess && apiHealth.data?.status !== 'ready' && apiHealth.data?.api !== 'ok');

  return (
    <DashboardShell role="admin" title="Curriculum setup completion">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Track FYUGP programme setup across semesters and categories. Green = complete, yellow =
          partial, red = not configured.
        </p>

        {apiUnavailable ? (
          <ApiConnectivityBanner
            message="Unable to reach the API server. Ensure the backend is running (port 3001) and try again."
            onRetry={() => void apiHealth.refetch()}
            isRetrying={apiHealth.isFetching}
          />
        ) : null}

        <CompactCard>
          <CompactCardHeader title="Filters" />
          <CompactCardBody className="space-y-3">
            {institutions.isError || departments.isError || programs.isError || batches.isError ? (
              <div className="space-y-2">
                {institutions.isError ? (
                  <QueryErrorPanel
                    title="Institutions unavailable"
                    error={institutions.error}
                    onRetry={() => void institutions.refetch()}
                    isRetrying={institutions.isFetching}
                  />
                ) : null}
                {departments.isError ? (
                  <QueryErrorPanel
                    title="Departments unavailable"
                    error={departments.error}
                    onRetry={() => void departments.refetch()}
                    isRetrying={departments.isFetching}
                  />
                ) : null}
                {programs.isError ? (
                  <QueryErrorPanel
                    title="Programmes unavailable"
                    error={programs.error}
                    onRetry={() => void programs.refetch()}
                    isRetrying={programs.isFetching}
                  />
                ) : null}
                {batches.isError ? (
                  <QueryErrorPanel
                    title="Admission batches unavailable"
                    error={batches.error}
                    onRetry={() => void batches.refetch()}
                    isRetrying={batches.isFetching}
                  />
                ) : null}
              </div>
            ) : null}
            <CompletionFilterBar
              filters={filters}
              onChange={(patch) => {
                setFilters((current) => ({ ...current, ...patch }));
                setCellSelection(null);
                setIssueFilter(undefined);
              }}
              onReset={() => {
                setFilters(emptyCompletionFilters());
                setCellSelection(null);
                setIssueFilter(undefined);
              }}
              institutionOptions={institutionOptions}
              programmeOptions={programmeOptions}
              departmentOptions={departmentOptions}
              batchOptions={batchOptions}
              highlightedSemester={summaryQuery.data?.highlightedSemester}
            />
          </CompactCardBody>
        </CompactCard>

        <CompletionSummaryCards
          summary={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
          isRetrying={summaryQuery.isFetching}
          onSelectIssue={(issue) => {
            setCellSelection(null);
            setIssueFilter(ISSUE_FILTER_MAP[issue]);
          }}
        />

        <CompactCard>
          <CompactCardHeader title="Completion matrix" />
          <CompactCardBody>
            <div className="mb-3">
              <CompletionExportMenu
                isPending={exportMut.isPending}
                onExport={(params) => exportMut.mutate({ ...queryParams, ...params })}
              />
            </div>
            {matrixQuery.isError ? (
              <QueryErrorPanel
                title="Matrix unavailable"
                error={matrixQuery.error}
                onRetry={() => void matrixQuery.refetch()}
                isRetrying={matrixQuery.isFetching}
              />
            ) : (
              <CompletionMatrix
                programmes={matrixQuery.data?.programmes ?? []}
                highlightedSemester={summaryQuery.data?.highlightedSemester}
                onSelectCell={(selection) => {
                  setIssueFilter(undefined);
                  setCellSelection(selection);
                }}
              />
            )}
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader title="Missing items" />
          <CompactCardBody>
            {missingQuery.isError ? (
              <QueryErrorPanel
                title="Missing items unavailable"
                error={missingQuery.error}
                onRetry={() => void missingQuery.refetch()}
                isRetrying={missingQuery.isFetching}
              />
            ) : (
              <MissingItemsPanel
                selection={cellSelection}
                issueTypeFilter={issueFilter}
                items={missingQuery.data?.data ?? []}
                isLoading={missingQuery.isLoading}
                onClear={() => {
                  setCellSelection(null);
                  setIssueFilter(undefined);
                }}
              />
            )}
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader title="Shared pool verification" />
          <CompactCardBody>
            <div className="mb-3 flex justify-end">
              <Link
                href="/admin/academic-engine?tab=pools"
                className="text-xs text-primary hover:underline"
              >
                Manage pools
              </Link>
            </div>
            {poolAuditQuery.isError ? (
              <QueryErrorPanel
                title="Shared pool audit unavailable"
                error={poolAuditQuery.error}
                onRetry={() => void poolAuditQuery.refetch()}
                isRetrying={poolAuditQuery.isFetching}
              />
            ) : (
              <SharedPoolsAuditPanel
                rows={poolAuditQuery.data ?? []}
                isLoading={poolAuditQuery.isLoading}
              />
            )}
          </CompactCardBody>
        </CompactCard>

        {exportMut.error ? (
          <p className="text-sm text-destructive" role="alert">
            {apiErrorMessage(exportMut.error, 'Export failed')}
          </p>
        ) : null}
      </div>
    </DashboardShell>
  );
}
