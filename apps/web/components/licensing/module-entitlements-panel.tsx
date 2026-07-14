'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchModuleEntitlements,
  isOptionalLicenseModule,
  setModuleEntitlement,
  type ModuleEntitlement,
} from '@/services/licensing';
import { apiErrorMessage } from '@/utils/api-error';

const OPTIONAL_FALLBACK: ModuleEntitlement[] = [
  { moduleKey: 'workflow', label: 'Workflow Engine', enabled: false },
  { moduleKey: 'helpdesk', label: 'Help Desk', enabled: false },
  { moduleKey: 'parent-portal', label: 'Parent Portal', enabled: false },
  { moduleKey: 'visitor-management', label: 'Visitor Management', enabled: false },
  { moduleKey: 'placement', label: 'Placement', enabled: false },
  { moduleKey: 'internship', label: 'Internship', enabled: false },
  { moduleKey: 'alumni', label: 'Alumni', enabled: false },
  { moduleKey: 'hostel', label: 'Hostel', enabled: false },
  { moduleKey: 'research', label: 'Research Grants', enabled: false },
  { moduleKey: 'integrations', label: 'Integrations', enabled: false },
];

function displayLabel(row: ModuleEntitlement): string {
  if (row.label) return row.label;
  return row.moduleKey
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ModuleEntitlementsPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const modulesQ = useQuery({
    queryKey: ['license', 'modules'],
    queryFn: fetchModuleEntitlements,
    enabled,
    retry: 1,
  });

  const toggleMut = useMutation({
    mutationFn: ({ moduleKey, next }: { moduleKey: string; next: boolean }) =>
      setModuleEntitlement(moduleKey, next),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['license', 'modules'] });
      void qc.invalidateQueries({ queryKey: ['license', 'modules', 'enabled'] });
    },
  });

  const rows = modulesQ.data?.length ? modulesQ.data : OPTIONAL_FALLBACK;
  const core = rows.filter(
    (r) => r.core === true || (!r.core && !isOptionalLicenseModule(r.moduleKey)),
  );
  const optional = rows.filter((r) => r.core !== true && isOptionalLicenseModule(r.moduleKey));
  const optionalRows = optional.length ? optional : OPTIONAL_FALLBACK;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Module entitlements
        </CardTitle>
        <CardDescription>
          Enable optional enterprise modules for this institution. Core modules stay on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {modulesQ.isError ? (
          <p className="text-sm text-amber-700">
            Could not load live entitlements ({apiErrorMessage(modulesQ.error)}). Showing optional
            module catalog — toggles will call the license API when available.
          </p>
        ) : null}

        {core.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Core modules</h3>
            <ul className="divide-y rounded-lg border">
              {core.map((row) => (
                <li
                  key={row.moduleKey}
                  className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{displayLabel(row)}</p>
                    {row.description ? (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    ) : null}
                  </div>
                  <Switch checked disabled aria-label={`${displayLabel(row)} (core)`} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Optional modules</h3>
          <ul className="divide-y rounded-lg border">
            {optionalRows.map((row) => {
              const pending =
                toggleMut.isPending && toggleMut.variables?.moduleKey === row.moduleKey;
              return (
                <li
                  key={row.moduleKey}
                  className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{displayLabel(row)}</p>
                    {row.description ? (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    ) : null}
                  </div>
                  <Switch
                    checked={Boolean(row.enabled)}
                    disabled={pending}
                    onCheckedChange={(next) => toggleMut.mutate({ moduleKey: row.moduleKey, next })}
                    aria-label={`Toggle ${displayLabel(row)}`}
                  />
                </li>
              );
            })}
          </ul>
          {toggleMut.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(toggleMut.error)}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
