'use client';

import { MapPin } from 'lucide-react';
import { CAMPUSES } from '@/config/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { cn } from '@/utils/cn';

export function CampusSwitcher({ compact }: { compact?: boolean }) {
  const campusId = useDashboardUiStore((s) => s.campusId);
  const setCampusId = useDashboardUiStore((s) => s.setCampusId);
  const active = CAMPUSES.find((c) => c.id === campusId) ?? CAMPUSES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3 py-2 text-sm backdrop-blur transition hover:bg-muted/50',
            compact && 'px-2',
          )}
          aria-label="Switch campus"
        >
          <MapPin className="h-4 w-4 text-primary" />
          {!compact ? (
            <span className="max-w-[140px] truncate font-medium">{active.name}</span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {CAMPUSES.map((campus) => (
          <DropdownMenuItem
            key={campus.id}
            onClick={() => setCampusId(campus.id)}
            className={cn(campusId === campus.id && 'bg-primary/10 text-primary')}
          >
            <div>
              <p className="font-medium">{campus.name}</p>
              <p className="text-xs text-muted-foreground">{campus.city}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
