import type { NavGroup, NavItem } from '@/config/navigation';
import { workspaceNavLabel } from '@/lib/workspace/workspace-utils';
import type { WorkspaceKind } from '@/lib/workspace/workspace-types';

const WORKSPACE_SCOPED_LABELS = new Set([
  'Student Directory',
  'Students',
  'Admissions',
  'Curriculum Manager',
  'Timetable',
  'Student Attendance',
  'Examinations',
  'Fee Collection',
  'Fee Reports',
  'Roll Numbers',
  'Identity Cards',
  'Shift Reports',
  'Operations',
]);

function relabelItem(item: NavItem, kind: WorkspaceKind): NavItem {
  const next: NavItem = { ...item };
  if (item.label && WORKSPACE_SCOPED_LABELS.has(item.label)) {
    next.label = workspaceNavLabel(item.label, kind);
  }
  if (item.children?.length) {
    next.children = item.children.map((child) => {
      if (!child.label || !WORKSPACE_SCOPED_LABELS.has(child.label)) return child;
      return { ...child, label: workspaceNavLabel(child.label, kind) };
    });
  }
  return next;
}

export function applyWorkspaceNavLabels(groups: NavGroup[], kind: WorkspaceKind): NavGroup[] {
  if (kind === 'institution') return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => relabelItem(item, kind)),
  }));
}
