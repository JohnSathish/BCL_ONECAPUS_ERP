import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  MapPin,
  Shield,
  User,
  Users,
} from 'lucide-react';

export const WIZARD_STEPS = [
  { id: 'basic', label: 'Basic', shortLabel: 'Basic', icon: User },
  { id: 'academic', label: 'Academic', shortLabel: 'Academic', icon: GraduationCap },
  { id: 'fyugp', label: 'FYUGP', shortLabel: 'Subjects', icon: BookOpen },
  { id: 'guardians', label: 'Guardians', shortLabel: 'Family', icon: Users },
  { id: 'address', label: 'Address', shortLabel: 'Address', icon: MapPin },
  { id: 'reservation', label: 'Reservation', shortLabel: 'Category', icon: Shield },
  { id: 'board', label: 'Board / CUET', shortLabel: 'Board', icon: BookOpen },
  { id: 'documents', label: 'Documents', shortLabel: 'Docs', icon: FileUp },
  { id: 'review', label: 'Review', shortLabel: 'Review', icon: ClipboardCheck },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}>;

export type StepId = (typeof WIZARD_STEPS)[number]['id'];

export const DRAFT_STORAGE_KEY = 'add-student-draft:v1';

export const CATEGORY_COLORS: Record<string, string> = {
  MAJOR: 'border-blue-500/40 bg-blue-500/10',
  MINOR: 'border-purple-500/40 bg-purple-500/10',
  MDC: 'border-orange-500/40 bg-orange-500/10',
  AEC: 'border-teal-500/40 bg-teal-500/10',
  SEC: 'border-pink-500/40 bg-pink-500/10',
  VAC: 'border-emerald-500/40 bg-emerald-500/10',
  VTC: 'border-indigo-500/40 bg-indigo-500/10',
};
