'use client';

import { useEffect, useState } from 'react';
import { Bookmark, ChevronDown, Plus, Trash2 } from 'lucide-react';

import {
  emptyStaffFilters,
  type StaffDirectoryFilters,
} from '@/components/staff-module/directory/staff-filter-utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STORAGE_KEY = 'staff-directory-saved-views';

type SavedView = {
  id: string;
  name: string;
  filters: Partial<StaffDirectoryFilters>;
};

const PRESET_VIEWS: SavedView[] = [
  { id: 'all', name: 'All Staff', filters: {} },
  { id: 'teaching', name: 'Teaching Staff', filters: { staffType: 'TEACHING' } },
  { id: 'non-teaching', name: 'Non-Teaching', filters: { staffType: 'NON_TEACHING' } },
  { id: 'guest', name: 'Guest / Visiting', filters: { staffType: 'GUEST' } },
  { id: 'portal', name: 'Portal Pending', filters: { uiPortalPending: 'true' } },
  { id: 'leave', name: 'On Leave', filters: { status: 'ON_LEAVE', uiOnLeave: 'true' } },
  { id: 'rfid', name: 'RFID Not Assigned', filters: { uiNoRfid: 'true' } },
  { id: 'department', name: 'No Department', filters: { uiNoDepartment: 'true' } },
];

function loadCustomViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

type Props = {
  currentFilters: StaffDirectoryFilters;
  onApply: (filters: StaffDirectoryFilters) => void;
  onReset: () => void;
};

export function StaffSavedViews({ currentFilters, onApply, onReset }: Props) {
  const [customViews, setCustomViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setCustomViews(loadCustomViews());
  }, []);

  const saveCurrent = () => {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    const next = [
      ...customViews,
      { id: `custom-${Date.now()}`, name: name.trim(), filters: { ...currentFilters } },
    ];
    setCustomViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const deleteView = (id: string) => {
    const next = customViews.filter((view) => view.id !== id);
    setCustomViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const applyView = (view: SavedView) => {
    onApply({ ...emptyStaffFilters(), ...view.filters, search: '' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-xs">
          <Bookmark className="mr-1 h-3.5 w-3.5" />
          Saved Views
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {PRESET_VIEWS.map((view) => (
          <DropdownMenuItem key={view.id} className="text-xs" onClick={() => applyView(view)}>
            {view.name}
          </DropdownMenuItem>
        ))}
        {customViews.length > 0 ? <DropdownMenuSeparator /> : null}
        {customViews.map((view) => (
          <DropdownMenuItem
            key={view.id}
            className="flex items-center justify-between text-xs"
            onClick={() => applyView(view)}
          >
            <span>{view.name}</span>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-rose-600"
              aria-label={`Delete ${view.name}`}
              onClick={(event) => {
                event.stopPropagation();
                deleteView(view.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onClick={saveCurrent}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Save current filters
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs" onClick={onReset}>
          Reset all filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
