'use client';

import { useEffect, useState } from 'react';
import { Bookmark, ChevronDown, Plus, Trash2 } from 'lucide-react';

import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STORAGE_KEY = 'directory-saved-views';

export type SavedView = {
  id: string;
  name: string;
  filters: Partial<DirectoryFilters>;
};

const PRESET_VIEWS: SavedView[] = [
  {
    id: 'preset-all',
    name: 'All Students',
    filters: {},
  },
  {
    id: 'preset-subjects',
    name: 'Subject Pending',
    filters: { uiSubjectPending: 'true' },
  },
  {
    id: 'preset-fee',
    name: 'Fee Defaulters',
    filters: { uiFeeDue: 'true' },
  },
  {
    id: 'preset-no-rfid',
    name: 'No RFID',
    filters: { uiRfidAssigned: 'false' },
  },
  {
    id: 'preset-no-photo',
    name: 'No Photo',
    filters: { uiNoPhoto: 'true' },
  },
  {
    id: 'preset-no-mobile',
    name: 'No Mobile',
    filters: { uiNoMobile: 'true' },
  },
  {
    id: 'preset-hostel',
    name: 'Hostellers',
    filters: { uiHostel: 'true' },
  },
  {
    id: 'preset-alumni',
    name: 'Alumni',
    filters: { studentStatus: 'ALUMNI' },
  },
  {
    id: 'preset-sem1',
    name: 'Sem 1 Students',
    filters: { semester: '1' },
  },
  {
    id: 'preset-attendance',
    name: 'Attendance Shortage',
    filters: { uiAttendanceShortage: 'true' },
  },
  {
    id: 'preset-recent',
    name: 'Recently Added',
    filters: { uiRecentlyAdded: 'true' },
  },
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

function saveCustomViews(views: SavedView[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

type Props = {
  currentFilters: DirectoryFilters;
  onApply: (filters: DirectoryFilters) => void;
  onReset: () => void;
};

export function DirectorySavedViews({ currentFilters, onApply, onReset }: Props) {
  const [customViews, setCustomViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setCustomViews(loadCustomViews());
  }, []);

  const saveCurrent = () => {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    const view: SavedView = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      filters: { ...currentFilters },
    };
    const next = [...customViews, view];
    setCustomViews(next);
    saveCustomViews(next);
  };

  const deleteView = (id: string) => {
    const next = customViews.filter((v) => v.id !== id);
    setCustomViews(next);
    saveCustomViews(next);
  };

  const applyView = (view: SavedView) => {
    onApply({ ...currentFilters, ...view.filters, search: currentFilters.search });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-full border-border/60 px-2.5 text-[11px]"
        >
          <Bookmark className="mr-1 h-3 w-3" />
          Saved Views
          <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {PRESET_VIEWS.map((view) => (
          <DropdownMenuItem key={view.id} className="text-xs" onClick={() => applyView(view)}>
            {view.name}
          </DropdownMenuItem>
        ))}
        {customViews.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {customViews.map((view) => (
              <DropdownMenuItem
                key={view.id}
                className="flex items-center justify-between text-xs"
                onClick={() => applyView(view)}
              >
                <span>{view.name}</span>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteView(view.id);
                  }}
                  aria-label={`Delete ${view.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onClick={saveCurrent}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Save current filters
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs text-muted-foreground" onClick={onReset}>
          Reset all filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
