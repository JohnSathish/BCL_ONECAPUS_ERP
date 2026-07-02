import type { AuthUser } from '@/types/auth';
import type { ShiftRow } from '@/services/shifts';
import { isSuperAdmin } from '@/lib/permissions/permission-registry';
import {
  WORKSPACE_DEFINITIONS,
  type WorkspaceDefinition,
  type WorkspaceKind,
} from '@/lib/workspace/workspace-types';

export function isShiftLockedUser(user?: AuthUser | null): boolean {
  if (!user) return false;
  if (user.allShifts) return false;
  return Boolean(user.shiftIds?.length || user.roles.some((r) => r.startsWith('shift-')));
}

export function canSwitchWorkspace(user?: AuthUser | null): boolean {
  if (!user) return false;
  return Boolean(user.allShifts || isSuperAdmin(user.roles));
}

export function accessibleWorkspaceKinds(user?: AuthUser | null): WorkspaceKind[] {
  if (!user) return [];
  if (canSwitchWorkspace(user)) {
    return ['institution', 'morning', 'day'];
  }
  const primaryId = user.primaryShiftId ?? user.shiftIds?.[0];
  if (!primaryId) return ['institution'];
  return [];
}

export function resolveLockedWorkspaceKind(
  user: AuthUser,
  shifts: ShiftRow[],
): WorkspaceKind | null {
  const primaryId = user.primaryShiftId ?? user.shiftIds?.[0];
  if (!primaryId) return null;
  const shift = shifts.find((s) => s.id === primaryId);
  if (shift?.code === 'MORNING') return 'morning';
  if (shift?.code === 'DAY') return 'day';
  const code = shift?.code?.toUpperCase();
  if (code?.includes('MORNING')) return 'morning';
  if (code === 'DAY' || code?.includes('DAY')) return 'day';
  return null;
}

export function resolveShiftForWorkspace(kind: WorkspaceKind, shifts: ShiftRow[]): ShiftRow | null {
  const def = WORKSPACE_DEFINITIONS[kind];
  if (!def.shiftCode) return null;
  return (
    shifts.find((s) => s.code === def.shiftCode && s.status === 'ACTIVE') ??
    shifts.find((s) => s.code === def.shiftCode) ??
    null
  );
}

export function workspaceKindFromShift(shift?: ShiftRow | null): WorkspaceKind | null {
  if (!shift) return null;
  if (shift.code === 'MORNING') return 'morning';
  if (shift.code === 'DAY') return 'day';
  const code = shift.code.toUpperCase();
  if (code.includes('MORNING')) return 'morning';
  if (code === 'DAY' || code.includes('DAY')) return 'day';
  return null;
}

export function workspaceHeaderTitle(kind: WorkspaceKind, institutionName?: string): string {
  const def = WORKSPACE_DEFINITIONS[kind];
  if (kind === 'institution') {
    return institutionName ? `${def.title} · ${institutionName}` : def.title;
  }
  return def.title;
}

export function workspaceNavLabel(baseLabel: string, kind: WorkspaceKind): string {
  if (kind === 'institution') return baseLabel;
  const prefix = kind === 'morning' ? 'Morning' : 'Day';
  if (baseLabel.toLowerCase().startsWith(prefix.toLowerCase())) return baseLabel;
  return `${prefix} ${baseLabel}`;
}

export function listSelectableWorkspaces(user?: AuthUser | null): WorkspaceDefinition[] {
  const kinds = accessibleWorkspaceKinds(user);
  if (kinds.length) {
    return kinds.map((kind) => WORKSPACE_DEFINITIONS[kind]);
  }
  return [];
}

export function shouldShowWorkspacePicker(user?: AuthUser | null, hasSelected?: boolean): boolean {
  if (!user || !canAccessAdmin(user)) return false;
  if (!canSwitchWorkspace(user)) return false;
  return !hasSelected;
}

function canAccessAdmin(user: AuthUser): boolean {
  return (
    isSuperAdmin(user.roles) ||
    user.roles.some((r) => r.startsWith('shift-')) ||
    user.allShifts === true
  );
}
