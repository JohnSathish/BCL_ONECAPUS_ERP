export type WorkspaceKind = 'institution' | 'morning' | 'day';

export type WorkspaceMode = 'institution' | 'shift';

export type WorkspaceAccent = {
  cssVar: string;
  label: string;
  badgeClass: string;
};

export type WorkspaceDefinition = {
  kind: WorkspaceKind;
  mode: WorkspaceMode;
  title: string;
  subtitle: string;
  shiftCode?: 'MORNING' | 'DAY';
};

export const WORKSPACE_DEFINITIONS: Record<WorkspaceKind, WorkspaceDefinition> = {
  institution: {
    kind: 'institution',
    mode: 'institution',
    title: 'Institution Dashboard',
    subtitle: 'Consolidated view across all shifts',
  },
  morning: {
    kind: 'morning',
    mode: 'shift',
    title: 'Morning Shift Administration',
    subtitle: 'Morning shift operations',
    shiftCode: 'MORNING',
  },
  day: {
    kind: 'day',
    mode: 'shift',
    title: 'Day Shift Administration',
    subtitle: 'Day shift operations',
    shiftCode: 'DAY',
  },
};

export const WORKSPACE_ACCENTS: Record<WorkspaceKind, WorkspaceAccent> = {
  institution: {
    cssVar: 'var(--primary)',
    label: 'Institution',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
  },
  morning: {
    cssVar: '#0d9488',
    label: 'Morning',
    badgeClass: 'bg-teal-500/10 text-teal-700 border-teal-500/25 dark:text-teal-300',
  },
  day: {
    cssVar: '#d97706',
    label: 'Day',
    badgeClass: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-300',
  },
};
