import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileCheck,
  GraduationCap,
  Library,
  Shield,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

export type LandingModule = {
  id: string;
  label: string;
  emoji: string;
  icon: LucideIcon;
  color: string;
  glow: string;
  description: string;
};

export const ORBIT_MODULES: LandingModule[] = [
  {
    id: 'admissions',
    label: 'Admissions',
    emoji: '🎓',
    icon: ClipboardList,
    color: 'from-sky-400 to-blue-500',
    glow: 'shadow-sky-500/40',
    description: 'End-to-end admission lifecycle from enquiry to enrollment.',
  },
  {
    id: 'academics',
    label: 'Academics',
    emoji: '📚',
    icon: BookOpen,
    color: 'from-indigo-400 to-violet-500',
    glow: 'shadow-indigo-500/40',
    description: 'FYUGP-ready curriculum, timetables, and course management.',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    emoji: '📅',
    icon: CalendarCheck,
    color: 'from-cyan-400 to-teal-500',
    glow: 'shadow-cyan-500/40',
    description: 'Biometric, RFID, and shift-aware attendance tracking.',
  },
  {
    id: 'examinations',
    label: 'Examinations',
    emoji: '📝',
    icon: FileCheck,
    color: 'from-fuchsia-400 to-purple-500',
    glow: 'shadow-fuchsia-500/40',
    description: 'Question banks, scheduling, grading, and result publishing.',
  },
  {
    id: 'hr',
    label: 'HR & Payroll',
    emoji: '👨‍🏫',
    icon: Users,
    color: 'from-violet-400 to-purple-600',
    glow: 'shadow-violet-500/40',
    description: 'Staff lifecycle, UGC/STATE payroll, and substitute management.',
  },
  {
    id: 'finance',
    label: 'Finance',
    emoji: '💰',
    icon: Wallet,
    color: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/40',
    description: 'Fee collection, ledgers, and institutional finance controls.',
  },
  {
    id: 'library',
    label: 'Library',
    emoji: '📖',
    icon: Library,
    color: 'from-emerald-400 to-green-500',
    glow: 'shadow-emerald-500/40',
    description: 'Catalogue, circulation, digital resources, and analytics.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    emoji: '📊',
    icon: BarChart3,
    color: 'from-rose-400 to-pink-500',
    glow: 'shadow-rose-500/40',
    description: 'AI-powered dashboards, NAAC reports, and KPI insights.',
  },
];

export const STAT_COUNTERS = [
  { value: 25, suffix: '+', label: 'Enterprise Modules', decimals: 0 },
  { value: 100, suffix: 'K+', label: 'Student Records', decimals: 0 },
  { value: 3, suffix: '', label: 'Shift Operations', decimals: 0 },
  { value: 98.9, suffix: '%', label: 'Platform Uptime', decimals: 1 },
] as const;

export const TRUST_PILLS = [
  { icon: GraduationCap, label: 'NEP 2020 Ready' },
  { icon: Building2, label: 'Multi-Campus' },
  { icon: Shield, label: 'Enterprise RBAC' },
  { icon: Sparkles, label: 'AI Analytics' },
] as const;

export const AI_FEATURES = [
  {
    icon: Brain,
    title: 'Predictive Insights',
    description: 'Surface at-risk students, fee defaults, and staffing gaps before they escalate.',
  },
  {
    icon: Bot,
    title: 'Campus AI Assistant',
    description: 'Natural-language queries across admissions, academics, finance, and HR data.',
  },
  {
    icon: Zap,
    title: 'Smart Automations',
    description: 'Auto-generate reports, timetable suggestions, and compliance-ready exports.',
  },
] as const;

export const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Modules', href: '#modules' },
  { label: 'AI Assistant', href: '#ai' },
  { label: 'Enterprise', href: '#enterprise' },
] as const;

export const REQUEST_DEMO_PATH = '/request-demo';

export const BCL_CONTACT = {
  phone: '9566363655',
  phoneDisplay: '+91 95663 63655',
  emails: ['contact@basecodelabs.com', 'johnsathish16@gmail.com'] as const,
};
