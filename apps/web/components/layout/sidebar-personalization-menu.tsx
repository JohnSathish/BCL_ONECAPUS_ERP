'use client';

import { Check, SlidersHorizontal } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavPreferencesStore } from '@/store/nav-preferences-store';
import { cn } from '@/utils/cn';

function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onToggle();
      }}
      className="justify-between gap-2"
    >
      <span>{label}</span>
      {checked ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <span className="h-4 w-4" />}
    </DropdownMenuItem>
  );
}

export function SidebarPersonalizationMenu({ collapsed }: { collapsed: boolean }) {
  const sidebarLayout = useNavPreferencesStore((s) => s.sidebarLayout);
  const setSidebarLayout = useNavPreferencesStore((s) => s.setSidebarLayout);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-sidebar-muted transition hover:bg-sidebar-active/50 hover:text-sidebar-foreground',
            collapsed ? 'w-full justify-center px-2' : 'w-full',
          )}
          aria-label="Sidebar personalization"
          title="Sidebar layout"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          {!collapsed ? <span className="flex-1 text-left text-xs">Sidebar layout</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Personalize sidebar
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ToggleRow
          label="Show favorites"
          checked={sidebarLayout.showFavorites}
          onToggle={() => setSidebarLayout({ showFavorites: !sidebarLayout.showFavorites })}
        />
        <ToggleRow
          label="Show recent items"
          checked={sidebarLayout.showRecentItems}
          onToggle={() => setSidebarLayout({ showRecentItems: !sidebarLayout.showRecentItems })}
        />
        <ToggleRow
          label="Show quick create (header)"
          checked={sidebarLayout.showQuickCreate}
          onToggle={() => setSidebarLayout({ showQuickCreate: !sidebarLayout.showQuickCreate })}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
