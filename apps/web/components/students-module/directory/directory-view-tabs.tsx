'use client';

import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';

import { cn } from '@/utils/cn';

export type DirectoryViewTab =
  | 'all'
  | 'current-sem'
  | 'subject-pending'
  | 'fee-due'
  | 'no-rfid'
  | 'no-photo'
  | 'no-mobile'
  | 'hostel'
  | 'alumni'
  | 'suspended';

const TABS: { id: DirectoryViewTab; label: string }[] = [
  { id: 'all', label: 'All Students' },

  { id: 'current-sem', label: 'Current Semester' },

  { id: 'subject-pending', label: 'Subject Pending' },

  { id: 'fee-due', label: 'Fee Due' },

  { id: 'no-rfid', label: 'No RFID' },

  { id: 'no-photo', label: 'No Photo' },

  { id: 'no-mobile', label: 'No Mobile' },

  { id: 'hostel', label: 'Hostel' },

  { id: 'alumni', label: 'Alumni' },

  { id: 'suspended', label: 'Suspended' },
];

type Props = {
  active: DirectoryViewTab;

  onChange: (tab: DirectoryViewTab) => void;

  currentSemester?: string;
};

export function getViewTabFilters(
  tab: DirectoryViewTab,

  currentSemester = '1',
): Partial<DirectoryFilters> {
  const clearUi = {
    uiSubjectPending: '',

    uiFeeDue: '',

    uiHostel: '',

    uiRfidAssigned: '',

    uiNoPhoto: '',

    uiNoMobile: '',
  };

  switch (tab) {
    case 'all':
      return {
        semester: '',

        studentStatus: '',

        academicStatus: '',

        ...clearUi,
      };

    case 'current-sem':
      return {
        semester: currentSemester,

        studentStatus: '',

        academicStatus: '',

        ...clearUi,
      };

    case 'subject-pending':
      return {
        uiSubjectPending: 'true',

        studentStatus: '',

        academicStatus: '',

        uiFeeDue: '',

        uiHostel: '',

        uiRfidAssigned: '',

        uiNoPhoto: '',

        uiNoMobile: '',
      };

    case 'fee-due':
      return {
        uiFeeDue: 'true',

        studentStatus: '',

        academicStatus: '',

        uiSubjectPending: '',

        uiHostel: '',

        uiRfidAssigned: '',

        uiNoPhoto: '',

        uiNoMobile: '',
      };

    case 'no-rfid':
      return {
        uiRfidAssigned: 'false',

        studentStatus: '',

        academicStatus: '',

        uiSubjectPending: '',

        uiFeeDue: '',

        uiHostel: '',

        uiNoPhoto: '',

        uiNoMobile: '',
      };

    case 'no-photo':
      return {
        uiNoPhoto: 'true',

        studentStatus: '',

        academicStatus: '',

        uiSubjectPending: '',

        uiFeeDue: '',

        uiHostel: '',

        uiRfidAssigned: '',

        uiNoMobile: '',
      };

    case 'no-mobile':
      return {
        uiNoMobile: 'true',

        studentStatus: '',

        academicStatus: '',

        uiSubjectPending: '',

        uiFeeDue: '',

        uiHostel: '',

        uiRfidAssigned: '',

        uiNoPhoto: '',
      };

    case 'hostel':
      return {
        uiHostel: 'true',

        studentStatus: '',

        academicStatus: '',

        uiSubjectPending: '',

        uiFeeDue: '',

        uiRfidAssigned: '',

        uiNoPhoto: '',

        uiNoMobile: '',
      };

    case 'alumni':
      return {
        studentStatus: 'ALUMNI',

        ...clearUi,
      };

    case 'suspended':
      return {
        studentStatus: 'DROPPED',

        ...clearUi,
      };

    default:
      return {};
  }
}

export function DirectoryViewTabs({ active, onChange, currentSemester }: Props) {
  return (
    <div className="flex gap-0.5 overflow-x-auto rounded-xl border border-border/50 bg-muted/20 p-0.5 scrollbar-none">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all',

            active === tab.id
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
              : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
          )}
        >
          {tab.label}

          {tab.id === 'current-sem' && currentSemester ? (
            <span className="ml-1 text-[10px] text-muted-foreground">(Sem {currentSemester})</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
