'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  humanizePermissionAction,
  type ModulePermissionGroup,
} from '@/lib/permissions/user-permission-ui';
import { cn } from '@/utils/cn';

type Props = {
  groups: ModulePermissionGroup[];
  effectiveSlugs: Set<string>;
  grantIds: Set<string>;
  denyIds: Set<string>;
  canEdit: boolean;
  onGrantChange: (permissionId: string, checked: boolean) => void;
  onDenyChange: (permissionId: string, checked: boolean) => void;
};

export function UserPermissionModuleTree({
  groups,
  effectiveSlugs,
  grantIds,
  denyIds,
  canEdit,
  onGrantChange,
  onDenyChange,
}: Props) {
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set());

  const toggleModule = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map(({ module, permissions }) => {
        const open = openModules.has(module.id);
        const effectiveCount = permissions.filter((p) => effectiveSlugs.has(p.slug)).length;

        return (
          <div
            key={`${module.id}-${module.label}`}
            className="rounded-lg border border-border/60 bg-card/40"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40"
              onClick={() => toggleModule(module.id)}
            >
              {open ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1">{module.label}</span>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {effectiveCount}/{permissions.length}
              </Badge>
            </button>

            {open ? (
              <ul className="space-y-0.5 border-t border-border/50 px-3 py-2">
                {permissions.map((perm) => {
                  const effective = effectiveSlugs.has(perm.slug);
                  const granted = grantIds.has(perm.id);
                  const denied = denyIds.has(perm.id);

                  return (
                    <li
                      key={perm.id}
                      className={cn(
                        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-sm',
                        effective && 'bg-primary/5',
                      )}
                    >
                      <span
                        className={cn(
                          'min-w-[120px] flex-1 font-medium',
                          effective ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {humanizePermissionAction(perm.slug)}
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {perm.slug}
                      </span>
                      {effective ? (
                        <Badge className="bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
                          Effective
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Not granted
                        </Badge>
                      )}
                      {canEdit ? (
                        <div className="flex gap-3 text-xs">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={granted}
                              onChange={(e) => onGrantChange(perm.id, e.target.checked)}
                            />
                            Grant
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={denied}
                              onChange={(e) => onDenyChange(perm.id, e.target.checked)}
                            />
                            Deny
                          </label>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
