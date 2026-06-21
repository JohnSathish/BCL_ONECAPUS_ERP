'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QUICK_CREATE_ACTIONS } from '@/config/nav-meta';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

function hasAnyPermission(userPerms: string[], required?: string[]) {
  if (!required?.length) return true;
  return required.some((p) => userPerms.includes(p));
}

export function QuickCreateMenu({ className }: { className?: string }) {
  const userPerms = useAuthStore((s) => s.session?.user?.permissions ?? []);

  const actions = useMemo(
    () => QUICK_CREATE_ACTIONS.filter((a) => hasAnyPermission(userPerms, a.permissions)),
    [userPerms],
  );

  if (!actions.length) return null;

  const primary = actions.slice(0, 6);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/15',
            className,
          )}
          aria-label="Create"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Quick create
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {primary.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem key={action.id} asChild>
              <Link
                href={action.href}
                prefetch={false}
                className="flex cursor-pointer items-center gap-2"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${action.color}22`, color: action.color }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{action.shortLabel ?? action.label}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
