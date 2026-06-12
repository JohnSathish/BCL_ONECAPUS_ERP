import type { NavGroup, NavItem } from '@/config/navigation';
import type { StaffNavContext } from '@/types/staff-portal';
import { hasAnyPermission } from '@/lib/permissions/portal-access';
const TEACHING_TYPES = new Set(['TEACHING', 'GUEST', 'VISITING', 'CONTRACT']);

const QB_PERMS = [
  'question-bank:read',
  'question-bank:contribute',
  'question-bank:download',
  'question-bank:approve',
  'question-bank:publish',
  'question-bank:manage',
];

export function isTeachingStaffType(staffType: string) {
  return TEACHING_TYPES.has(staffType);
}

export function buildStaffNavContext(profile: {
  staffType: string;
  isTeaching?: boolean;
  isHod?: boolean;
  isAdminStaff?: boolean;
  permissions?: string[];
}): StaffNavContext {
  return {
    staffType: profile.staffType,
    isTeaching: profile.isTeaching ?? isTeachingStaffType(profile.staffType),
    isHod: profile.isHod ?? false,
    isAdminStaff: profile.isAdminStaff ?? profile.staffType === 'ADMIN',
    permissions: profile.permissions ?? [],
  };
}

function canAccessQuestionBank(ctx: StaffNavContext) {
  return hasAnyPermission(ctx.permissions ?? [], QB_PERMS);
}

function itemVisible(item: NavItem, ctx: StaffNavContext): boolean {
  const tag = item.label;
  if (tag === 'Question Bank' && !canAccessQuestionBank(ctx)) return false;
  if (ctx.isTeaching) return true;
  if (ctx.isAdminStaff) {
    return ![
      'Teaching Load',
      'Lesson Plans',
      'Homework / Assignments',
      'Question Bank',
      'Marks Entry',
      'Attendance Entry',
    ].includes(tag);
  }
  const academicOnly = [
    'Academic',
    'My Subjects',
    'Teaching Load',
    'Timetable',
    'Lesson Plans',
    'Homework / Assignments',
    'Question Bank',
    'Examinations',
    'Student Lists',
    'Marks Entry',
    'Attendance Entry',
  ];
  if (academicOnly.includes(tag)) return false;
  return true;
}

function filterItems(items: NavItem[], ctx: StaffNavContext): NavItem[] {
  return items
    .filter((item) => itemVisible(item, ctx))
    .map((item) => {
      if (!item.children?.length) return item;
      const children = item.children.filter((child) => {
        if (child.href.includes('/question-bank') && !canAccessQuestionBank(ctx)) return false;
        if (ctx.isTeaching) return true;
        if (ctx.isAdminStaff) {
          return !child.href.includes('/academic/');
        }
        return !child.href.includes('/academic/');
      });
      if (children.length === 0) return null;
      return { ...item, children };
    })
    .filter(Boolean) as NavItem[];
}

export function filterStaffNav(groups: NavGroup[], ctx: StaffNavContext): NavGroup[] {
  return groups
    .map((group) => {
      if (group.label === 'Academic' && !ctx.isTeaching) return null;
      if (group.label === 'Administration' && !ctx.isAdminStaff && !ctx.isHod) return null;

      const items = filterItems(group.items, ctx);
      if (items.length === 0) return null;
      return { ...group, items };
    })
    .filter(Boolean) as NavGroup[];
}
