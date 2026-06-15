import type { LucideIcon } from 'lucide-react';

import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Cloud,
  FileCheck,
  GraduationCap,
  Layers,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';

/** Set false to keep the login hero fully static (no motion, counters, or carousels). */

export const LOGIN_HERO_ANIMATIONS_ENABLED = true;

/** Primary highlights — mobile 2×2 grid. */

export const PRIMARY_FEATURE_BADGES: { icon: LucideIcon; label: string }[] = [
  { icon: GraduationCap, label: 'NEP Ready' },

  { icon: Sparkles, label: 'AI Powered' },

  { icon: Building2, label: 'Multi-Campus' },

  { icon: Award, label: 'NAAC Ready' },
];

/** Secondary highlights — behind expandable accordion on mobile. */

export const SECONDARY_FEATURE_BADGES: { icon: LucideIcon; label: string }[] = [
  { icon: Shield, label: 'Enterprise RBAC' },

  { icon: Cloud, label: 'Cloud Native' },

  { icon: CheckCircle2, label: 'Shift Administration' },

  { icon: Layers, label: 'FYUGP Compatible' },
];

export const TRUST_INDICATORS: { icon: LucideIcon; label: string }[] = [
  { icon: Building2, label: 'Trusted by Colleges' },

  { icon: GraduationCap, label: 'NEP/FYUGP Compatible' },

  { icon: Shield, label: 'Secure Cloud Platform' },
];

export const MOBILE_STATS_STRIP: { value: string; label: string }[] = [
  { value: '10,000+', label: 'Students Managed' },

  { value: '50+', label: 'Departments' },

  { value: '99.9%', label: 'Uptime' },
];

/** Full desktop capability list. */

export const TRUST_BADGES: { icon: LucideIcon; label: string }[] = [
  { icon: GraduationCap, label: 'NEP 2020 Ready' },

  { icon: Building2, label: 'Multi-campus' },

  { icon: Shield, label: 'Enterprise RBAC' },

  { icon: Sparkles, label: 'AI Analytics' },

  { icon: Layers, label: 'FYUGP Compatible' },

  { icon: CheckCircle2, label: 'Shift-Based Administration' },

  { icon: Cloud, label: 'Cloud-Native Architecture' },

  { icon: Award, label: 'NAAC/NBA Reporting Ready' },
];

export const TRUST_BADGES_VISIBLE = 4;

export const MODULE_STRIP: { icon: LucideIcon; label: string }[] = [
  { icon: ClipboardList, label: 'Admissions' },

  { icon: BookOpen, label: 'Academics' },

  { icon: CalendarCheck, label: 'Attendance' },

  { icon: FileCheck, label: 'Examinations' },

  { icon: Wallet, label: 'Finance' },

  { icon: BarChart3, label: 'Analytics' },
];

export type KpiMetric = {
  value: number;

  suffix?: string;

  prefix?: string;

  label: string;

  decimals?: number;

  textOnly?: boolean;
};

export const KPI_METRICS: KpiMetric[] = [
  { value: 25, suffix: '+', label: 'Enterprise Modules' },

  { value: 100, suffix: 'K+', label: 'Student Records' },

  { value: 3, label: 'Shift Operations' },

  { value: 98.9, suffix: '%', label: 'Uptime', decimals: 1 },

  { value: 0, label: 'AI-Powered Analytics', textOnly: true },

  { value: 0, label: 'NEP 2020 Compatible', textOnly: true },
];

/** Primary stats shown in the static 2×2 grid (numeric KPIs only). */

export const KPI_GRID_METRICS = KPI_METRICS.filter((m) => !m.textOnly).slice(0, 4);
