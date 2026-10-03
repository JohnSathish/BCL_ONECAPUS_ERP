'use client';

import { useEffect, useState } from 'react';
import { Bookmark, ChevronDown, Plus, Trash2 } from 'lucide-react';

import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';

function blankFilters(): DirectoryFilters {
  return {
    search: '',
    programVersionId: '',
    shiftId: '',
    batchId: '',
    semester: '',
    streamId: '',
    admissionStatus: '',
    academicStatus: '',
    departmentId: '',
    sessionId: '',
    categoryLookupId: '',
    religionLookupId: '',
    differentlyAbled: '',
    studentStatus: '',
    admissionType: '',
    uiSubjectPending: '',
    uiFeeDue: '',
    uiHostel: '',
    uiRfidAssigned: '',
    uiAttendanceShortage: '',
    uiRecentlyAdded: '',
    uiNoPhoto: '',
    uiNoMobile: '',
    uiAbcStatus: '',
  };
}
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
    id: 'preset-fee',
    name: 'Fee Pending',
    filters: { uiFeeDue: 'true' },
  },
  {
    id: 'preset-attendance',
    name: 'Attendance Risk',
    filters: { uiAttendanceShortage: 'true' },
  },
  {
    id: 'preset-no-mobile',
    name: 'No Mobile Number',
    filters: { uiNoMobile: 'true' },
  },
  {
    id: 'preset-no-photo',
    name: 'No Photo',
    filters: { uiNoPhoto: 'true' },
  },
  {
    id: 'preset-hostel',
    name: 'Hostellers',
    filters: { uiHostel: 'true' },
  },
  {
    id: 'preset-sem1',
    name: 'Semester 1',
    filters: { semester: '1' },
  },
  {
    id: 'preset-sem2',
    name: 'Semester 2',
    filters: { semester: '2' },
  },
  {
    id: 'preset-sem3',
    name: 'Semester 3',
    filters: { semester: '3' },
  },
  {
    id: 'preset-sem5',
    name: 'Semester 5',
    filters: { semester: '5' },
  },
  {
    id: 'preset-geography',
    name: 'Geography Students',
    filters: { departmentId: '__geography__' },
  },
  {
    id: 'preset-pending',
    name: 'Pending Enrollment',
    filters: { studentStatus: 'PENDING' },
  },
  {
    id: 'preset-recent',
    name: 'Recently Added',
    filters: { uiRecentlyAdded: 'true' },
  },
  {
    id: 'preset-subjects',
    name: 'Subject Pending',
    filters: { uiSubjectPending: 'true' },
  },
  {
    id: 'preset-alumni',
    name: 'Alumni',
    filters: { studentStatus: 'ALUMNI' },
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
  departmentOptions?: { id: string; label: string }[];
  onApply: (filters: DirectoryFilters) => void;
  onReset: () => void;
};

export function DirectorySavedViews({
  currentFilters,
  departmentOptions = [],
  onApply,
  onReset,
}: Props) {
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
    const next = { ...blankFilters(), ...view.filters, search: '' };
    if (next.departmentId === '__geography__') {
      next.departmentId = departmentOptions.find((d) => /geography/i.test(d.label))?.id ?? '';
    }
    onApply(next);
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
