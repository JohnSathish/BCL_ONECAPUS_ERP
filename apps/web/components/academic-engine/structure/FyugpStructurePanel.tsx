'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  applyTemplateToVersion,
  fetchFyugpTemplates,
  fetchProgramStructure,
  loadNehuFyugpDefaults,
  upsertProgramStructure,
} from '@/services/academic-engine';
import { fetchPrograms } from '@/services/programs';
import { formatDisplayDateTime } from '@/utils/format-date';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';
import { CloneStructureDialog } from './CloneStructureDialog';
import { CopySemesterPatternDialog } from './CopySemesterPatternDialog';
import { FyugpTemplateManagerDialog } from './FyugpTemplateManagerDialog';
import { FyugpStructureToolbar } from './FyugpStructureToolbar';
import { SemesterRuleEditor } from './SemesterRuleEditor';
import {
  buildEmptyRules,
  buildProgramOptions,
  buildVersionOptions,
  DEFAULT_DEGREE_MIN_CREDITS,
  DEFAULT_SEMESTER_CREDIT_TARGET,
  type RuleDraft,
} from './structure-types';

type FyugpStructurePanelProps = {
  programVersionId: string;
  enabled: boolean;
};

export function FyugpStructurePanel({ programVersionId, enabled }: FyugpStructurePanelProps) {
  const qc = useQueryClient();
  const [ruleDrafts, setRuleDrafts] = useState<RuleDraft[]>(buildEmptyRules());
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyDialogMode, setApplyDialogMode] = useState<
    'ALL_UG' | 'SELECTED_PROGRAMS' | 'SELECTED_VERSIONS'
  >('ALL_UG');
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);

  const structure = useQuery({
    queryKey: ['academic-engine', 'structure', programVersionId],
    queryFn: () => fetchProgramStructure(programVersionId),
    enabled: enabled && Boolean(programVersionId),
  });

  const templatesQuery = useQuery({
    queryKey: ['academic-engine', 'fyugp-templates'],
    queryFn: () => fetchFyugpTemplates(true),
    enabled,
  });

  const programsQuery = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled,
  });

  const programOptions = useMemo(
    () => buildProgramOptions(programsQuery.data?.data ?? []),
    [programsQuery.data],
  );
  const versionOptions = useMemo(() => buildVersionOptions(programOptions), [programOptions]);

  const totalSemesters = structure.data?.template?.totalSemesters ?? 8;

  useEffect(() => {
    const base = buildEmptyRules(totalSemesters);
    if (!structure.data?.rules?.length) {
      setRuleDrafts(base);
      return;
    }
    const bySemester = new Map(
      structure.data.rules.map((rule) => [
        rule.semesterSequence,
        {
          semesterSequence: rule.semesterSequence,
          categoryCounts: { ...(rule.categoryCounts as Record<string, number>) },
          continuityRules: { ...(rule.continuityRules as Record<string, string>) },
          categoryMeta: { ...(rule.categoryMeta ?? {}) },
          semesterCreditTarget:
            rule.semesterCreditTarget ??
            structure.data?.template?.semesterCreditTarget ??
            DEFAULT_SEMESTER_CREDIT_TARGET,
        },
      ]),
    );
    setRuleDrafts(base.map((empty) => bySemester.get(empty.semesterSequence) ?? empty));
  }, [structure.data, totalSemesters]);

  const saveStructureMut = useMutation({
    mutationFn: () => upsertProgramStructure(programVersionId, { semesterRules: ruleDrafts }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['academic-engine', 'structure'] }),
  });

  const loadDefaultsMut = useMutation({
    mutationFn: () => loadNehuFyugpDefaults(programVersionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['academic-engine', 'structure'] }),
  });

  const applyCurrentMut = useMutation({
    mutationFn: () => applyTemplateToVersion(programVersionId, selectedTemplateId, 'REPLACE_ALL'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['academic-engine', 'structure'] }),
  });

  const updateRuleCount = (sem: number, cat: string, value: number) => {
    setRuleDrafts((prev) =>
      prev.map((rule) =>
        rule.semesterSequence === sem
          ? {
              ...rule,
              categoryCounts: {
                ...rule.categoryCounts,
                [cat]: Math.max(0, value),
              },
            }
          : rule,
      ),
    );
  };

  const updateRuleContinuity = (sem: number, cat: string, value: string) => {
    setRuleDrafts((prev) =>
      prev.map((rule) => {
        if (rule.semesterSequence !== sem) return rule;
        const continuityRules = { ...rule.continuityRules };
        if (!value) delete continuityRules[cat];
        else continuityRules[cat] = value;
        return { ...rule, continuityRules };
      }),
    );
  };

  const updateRuleCredit = (sem: number, cat: string, value: number) => {
    setRuleDrafts((prev) =>
      prev.map((rule) => {
        if (rule.semesterSequence !== sem) return rule;
        const categoryMeta = { ...(rule.categoryMeta ?? {}) };
        categoryMeta[cat] = {
          ...(categoryMeta[cat] ?? {}),
          creditRule: Math.max(0, value),
          mandatory: categoryMeta[cat]?.mandatory ?? true,
        };
        return { ...rule, categoryMeta };
      }),
    );
  };

  const updateRuleMandatory = (sem: number, cat: string, value: boolean) => {
    setRuleDrafts((prev) =>
      prev.map((rule) => {
        if (rule.semesterSequence !== sem) return rule;
        const categoryMeta = { ...(rule.categoryMeta ?? {}) };
        categoryMeta[cat] = {
          ...(categoryMeta[cat] ?? {}),
          mandatory: value,
        };
        return { ...rule, categoryMeta };
      }),
    );
  };

  const copySemesterPattern = (sourceSemester: number, targetSemesters: number[]) => {
    setRuleDrafts((prev) => {
      const source = prev.find((rule) => rule.semesterSequence === sourceSemester);
      if (!source) return prev;
      return prev.map((rule) =>
        targetSemesters.includes(rule.semesterSequence)
          ? {
              ...rule,
              categoryCounts: { ...source.categoryCounts },
              continuityRules: { ...source.continuityRules },
              categoryMeta: { ...(source.categoryMeta ?? {}) },
            }
          : rule,
      );
    });
  };

  const openApplyDialog = (mode: typeof applyDialogMode) => {
    setApplyDialogMode(mode);
    setApplyDialogOpen(true);
  };

  const openManager = (templateId: string | null = null) => {
    setEditTemplateId(templateId);
    setManagerOpen(true);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const disabled = !programVersionId;

  return (
    <>
      <CompactCard className="min-w-0">
        <CompactCardHeader
          title="Semester structure rules"
          description="Edit NEP category counts and continuity per semester, or apply a global FYUGP template"
        />
        <CompactCardBody className="space-y-4">
          <FyugpStructureToolbar
            disabled={disabled}
            selectedTemplateId={selectedTemplateId}
            templates={templatesQuery.data ?? []}
            saving={saveStructureMut.isPending}
            loadingDefaults={loadDefaultsMut.isPending}
            applyingTemplate={applyCurrentMut.isPending}
            onTemplateChange={handleTemplateChange}
            onApplyToCurrent={() => applyCurrentMut.mutate()}
            onApplyToProgrammes={() => openApplyDialog('ALL_UG')}
            onBulkUpdate={() => openApplyDialog('SELECTED_VERSIONS')}
            onCloneStructure={() => setCloneDialogOpen(true)}
            onCopySemesterPattern={() => setCopyDialogOpen(true)}
            onLoadNehuDefaults={() => loadDefaultsMut.mutate()}
            onManageTemplates={() => openManager(selectedTemplateId || null)}
            onSave={() => saveStructureMut.mutate()}
          />

          {structure.data?.template ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Structure: {structure.data.template.structureType} ·{' '}
                {structure.data.template.totalSemesters} semesters · target{' '}
                {structure.data.template.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET}{' '}
                credits/sem · degree min{' '}
                {structure.data.template.degreeMinCredits ?? DEFAULT_DEGREE_MIN_CREDITS} credits
              </p>
              {structure.data.template.lastAppliedFyugpTemplate ? (
                <p>
                  Last applied template:{' '}
                  {structure.data.template.lastAppliedFyugpTemplate.templateName}
                  {structure.data.template.lastAppliedAt
                    ? ` · ${formatDisplayDateTime(structure.data.template.lastAppliedAt)}`
                    : ''}
                </p>
              ) : null}
            </div>
          ) : null}

          <SemesterRuleEditor
            rules={ruleDrafts}
            onUpdateCount={updateRuleCount}
            onUpdateContinuity={updateRuleContinuity}
            onUpdateCredit={updateRuleCredit}
            onUpdateMandatory={updateRuleMandatory}
          />
        </CompactCardBody>
      </CompactCard>

      {selectedTemplateId ? (
        <ApplyTemplateDialog
          open={applyDialogOpen}
          onOpenChange={setApplyDialogOpen}
          templateId={selectedTemplateId}
          programs={programOptions}
          initialMode={applyDialogMode}
        />
      ) : null}

      <CloneStructureDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        targetVersionId={programVersionId}
        versions={versionOptions}
      />

      <CopySemesterPatternDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        totalSemesters={totalSemesters}
        onCopy={copySemesterPattern}
      />

      <FyugpTemplateManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        templateId={editTemplateId}
      />
    </>
  );
}
