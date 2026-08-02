'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Library,
  Package,
  Shield,
  Users,
  Wallet,
  FileText,
  Bus,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchModuleEntitlements,
  isOptionalLicenseModule,
  setModuleEntitlement,
  type ModuleEntitlement,
} from '@/services/licensing';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const OPTIONAL_FALLBACK: ModuleEntitlement[] = [
  {
    moduleKey: 'workflow',
    label: 'Workflow Engine',
    enabled: false,
    description: 'Approval workflows',
  },
  {
    moduleKey: 'helpdesk',
    label: 'Help Desk',
    enabled: false,
    description: 'Ticketing and support',
  },
  {
    moduleKey: 'parentPortal',
    label: 'Parent Portal',
    enabled: false,
    description: 'Guardian access',
  },
  {
    moduleKey: 'visitorManagement',
    label: 'Visitor Management',
    enabled: false,
    description: 'Campus visitors',
  },
  { moduleKey: 'placement', label: 'Placement', enabled: false, description: 'Campus placements' },
  {
    moduleKey: 'internship',
    label: 'Internship',
    enabled: false,
    description: 'Internship tracking',
  },
  { moduleKey: 'alumni', label: 'Alumni', enabled: false, description: 'Alumni network' },
  { moduleKey: 'hostel', label: 'Hostel', enabled: false, description: 'Hostel management' },
  {
    moduleKey: 'research',
    label: 'Research Grants',
    enabled: false,
    description: 'Research grants',
  },
  {
    moduleKey: 'integrations',
    label: 'Integrations',
    enabled: false,
    description: 'External integrations',
  },
];

const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: Users,
  admissions: ClipboardList,
  academics: GraduationCap,
  examinations: FileText,
  finance: Wallet,
  accounts: Wallet,
  certificates: FileText,
  administration: Shield,
  settings: Shield,
  staff: Users,
  library: Library,
  transport: Bus,
  hostel: Building2,
  inventory: Package,
  shorttermcourses: BookOpen,
  lms: BookOpen,
};

function iconFor(moduleKey: string): LucideIcon {
  const normalized = moduleKey.replace(/[-_]/g, '').toLowerCase();
  return MODULE_ICONS[normalized] ?? Boxes;
}

function displayLabel(row: ModuleEntitlement): string {
  if (row.label) return row.label;
  return row.moduleKey
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isCoreRow(row: ModuleEntitlement): boolean {
  if (row.core === true) return true;
  if (row.core === false) return false;
  return !isOptionalLicenseModule(row.moduleKey);
}

export function ModuleEntitlementsPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const rows = useMemo(() => {
    if (modulesQ.data?.length) return modulesQ.data;
    return OPTIONAL_FALLBACK;
  }, [modulesQ.data]);

  const enabledCount = rows.filter((r) => r.enabled || isCoreRow(r)).length;
  const totalCount = rows.length;
  const progressPct = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-white px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Boxes className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Module Entitlements</h2>
            <p className="text-sm text-slate-500">
              Enable or disable optional enterprise modules for this institution. Core modules stay
              on.
            </p>
          </div>
        </div>
        <div className="w-full max-w-[200px] sm:pt-1">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-emerald-700">
            <span>
              {enabledCount} / {totalCount} Modules Enabled
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-0">
        {modulesQ.isError ? (
          <p className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            Could not load live entitlements ({apiErrorMessage(modulesQ.error)}). Showing optional
            module catalog — toggles will call the license API when available.
          </p>
        ) : null}

        <div className="hidden grid-cols-[minmax(0,1fr)_auto_2.5rem] gap-3 border-b border-slate-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid">
          <span>Module</span>
          <span className="w-[4.5rem] text-center">Status</span>
          <span />
        </div>

        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const core = isCoreRow(row);
            const pending = toggleMut.isPending && toggleMut.variables?.moduleKey === row.moduleKey;
            const Icon = iconFor(row.moduleKey);
            const isOpen = expanded === row.moduleKey;
            const label = displayLabel(row);
            const checked = core ? true : Boolean(row.enabled);

            return (
              <li key={row.moduleKey}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-3 px-5 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {label}
                        {!core ? (
                          <span className="ml-1.5 text-xs font-medium text-slate-400">
                            (Optional)
                          </span>
                        ) : null}
                      </p>
                      {row.description ? (
                        <p className="truncate text-xs text-slate-500">{row.description}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-[4.5rem] justify-center">
                    <Switch
                      checked={checked}
                      disabled={core || pending}
                      onCheckedChange={(next) =>
                        toggleMut.mutate({ moduleKey: row.moduleKey, next })
                      }
                      aria-label={`${checked ? 'Disable' : 'Enable'} ${label}`}
                    />
                  </div>

                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    aria-expanded={isOpen}
                    aria-label={`Details for ${label}`}
                    onClick={() => setExpanded(isOpen ? null : row.moduleKey)}
                  >
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
                    />
                  </button>
                </div>

                {isOpen ? (
                  <div className="border-t border-slate-50 bg-slate-50/60 px-5 py-3 pl-[4.25rem] text-xs text-slate-600">
                    {core ? (
                      <p>Core module — always enabled for this institution.</p>
                    ) : (
                      <p>
                        Optional enterprise module. Turning this off hides related menus and
                        features until re-enabled.
                      </p>
                    )}
                    {row.description ? (
                      <p className="mt-1 text-slate-500">{row.description}</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {toggleMut.isError ? (
          <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {apiErrorMessage(toggleMut.error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
