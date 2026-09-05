'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { SCHOOL_CASTE_CATEGORY_POLICY } from '@/lib/school-admission-category';
import {
  DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS,
  type SchoolDocumentRequirementRule,
} from '@/lib/school-document-requirements';
import {
  fetchSchoolOfficeSettings,
  updateSchoolDocumentRequirements,
} from '@/services/school-admissions';
import { apiErrorMessage } from '@/utils/api-error';

function rulesFromApi(
  rules:
    | Array<{
        id: string;
        slotCode: string;
        label: string;
        helperText: string;
        communities?: string[];
        categories?: string[];
        required: boolean;
      }>
    | undefined,
): SchoolDocumentRequirementRule[] {
  if (!rules?.length) {
    return structuredClone(DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS.rules);
  }
  return structuredClone(
    rules.map((rule) => ({
      ...rule,
      slotCode: rule.slotCode as SchoolDocumentRequirementRule['slotCode'],
    })),
  );
}

export default function SchoolAdmissionsSettingsPage() {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['school-office-settings'],
    queryFn: fetchSchoolOfficeSettings,
    enabled,
  });
  const [rules, setRules] = useState<SchoolDocumentRequirementRule[]>(
    structuredClone(DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS.rules),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.documentRequirements?.rules) {
      setRules(rulesFromApi(settings.data.documentRequirements.rules));
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => updateSchoolDocumentRequirements({ rules }),
    onSuccess: async () => {
      setError(null);
      setMessage('Certificate requirements saved. Parent portal will use the updated rules.');
      await queryClient.invalidateQueries({ queryKey: ['school-office-settings'] });
    },
    onError: (err) => {
      setMessage(null);
      setError(apiErrorMessage(err));
    },
  });

  const updateRule = (index: number, patch: Partial<SchoolDocumentRequirementRule>) => {
    setRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/school-admissions"
          className="text-sm font-medium text-[var(--school-erp-primary)] underline"
        >
          ← Applications
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--school-erp-primary)]">
          Certificate requirement settings
        </h1>
        <p className="mt-1 text-sm text-[var(--school-erp-muted)]">
          Parents declare only the child’s Caste / Category and Community / Tribe. These rules
          decide which certificate (if any) appears on the Documents page — including Caste
          Certificate for General / UR — without code changes.
        </p>
      </div>

      {settings.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      ) : null}

      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={rule.id || rule.slotCode} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1a5336]">
              {rule.slotCode}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Document name</Label>
                <Input
                  className="mt-1"
                  value={rule.label}
                  onChange={(e) => updateRule(index, { label: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Helper text</Label>
                <Input
                  className="mt-1"
                  value={rule.helperText}
                  onChange={(e) => updateRule(index, { helperText: e.target.value })}
                />
              </div>
              <div>
                <Label>Communities (comma-separated)</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Garo, Khasi, Jaintia"
                  value={(rule.communities ?? []).join(', ')}
                  onChange={(e) =>
                    updateRule(index, {
                      communities: e.target.value
                        .split(',')
                        .map((part) => part.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave empty if this rule should not depend on Community / Tribe.
                </p>
              </div>
              <div>
                <Label>Categories (comma-separated codes)</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. ST, OBC"
                  value={(rule.categories ?? []).join(', ')}
                  onChange={(e) =>
                    updateRule(index, {
                      categories: e.target.value
                        .split(',')
                        .map((part) => part.trim().toUpperCase())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Allowed codes: {SCHOOL_CASTE_CATEGORY_POLICY.map((c) => c.code).join(', ')}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rule.required !== false}
                  onChange={(e) => updateRule(index, { required: e.target.checked })}
                />
                Required when this rule matches
              </label>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="bg-[#1a5336] text-white hover:bg-[#15462d]"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save certificate rules'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setRules(structuredClone(DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS.rules))}
        >
          Reset to school defaults
        </Button>
      </div>
    </div>
  );
}
