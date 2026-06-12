import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  Shield,
  User,
  Wallet,
} from 'lucide-react';

export const WIZARD_STEPS = [
  { id: 'basic', label: 'Basic', shortLabel: 'Basic', icon: User },
  { id: 'employment', label: 'Employment', shortLabel: 'Employment', icon: Briefcase },
  { id: 'subjects', label: 'Subjects', shortLabel: 'Subjects', icon: GraduationCap },
  { id: 'portal', label: 'Portal', shortLabel: 'Portal', icon: Shield },
  { id: 'salary', label: 'Salary', shortLabel: 'Salary', icon: Wallet },
  { id: 'documents', label: 'Documents', shortLabel: 'Docs', icon: FileUp },
  { id: 'review', label: 'Review', shortLabel: 'Review', icon: ClipboardCheck },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}>;

export type StaffStepId = (typeof WIZARD_STEPS)[number]['id'];

export const DRAFT_STORAGE_KEY = 'add-staff-draft:v1';

export const STAFF_TYPE_COLORS: Record<string, string> = {
  ALL: 'from-primary/10 via-primary/5 to-transparent',
  TEACHING: 'from-blue-500/10 via-blue-500/5 to-transparent',
  NON_TEACHING: 'from-slate-500/10 via-slate-500/5 to-transparent',
  GUEST: 'from-amber-500/10 via-amber-500/5 to-transparent',
  VISITING: 'from-amber-500/10 via-amber-500/5 to-transparent',
  CONTRACT: 'from-orange-500/10 via-orange-500/5 to-transparent',
  ADMIN: 'from-violet-500/10 via-violet-500/5 to-transparent',
};

export const STAFF_DOC_TYPES = [
  'AADHAAR',
  'PAN',
  'QUALIFICATION',
  'EXPERIENCE',
  'APPOINTMENT_ORDER',
  'PHOTO',
  'OTHER',
] as const;

export const PORTAL_ROLE_OPTIONS = [
  { slug: 'faculty', label: 'Faculty' },
  { slug: 'shift', label: 'Shift In-charge' },
  { slug: 'librarian', label: 'Librarian' },
  { slug: 'accountant', label: 'Accountant' },
] as const;
