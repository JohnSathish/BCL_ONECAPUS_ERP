import type { CSSProperties } from 'react';
import type { AppearanceConfig } from '@/lib/school-sis/appearance';
import { mixHex } from '@/lib/school-sis/appearance';

export function appearanceCssVars(
  cfg: AppearanceConfig | undefined,
  extras?: { sidebarWidth?: number; fontFamily?: string; radius?: number },
): CSSProperties {
  if (!cfg) return {};
  const primary = cfg.colors.primary;
  const hover = mixHex(primary, '#0F172A', 0.18);
  const deep = mixHex(primary, '#0F172A', 0.35);
  return {
    ['--school-erp-primary' as string]: primary,
    ['--school-erp-primary-hover' as string]: hover,
    ['--school-erp-primary-deep' as string]: deep,
    ['--school-erp-accent' as string]: cfg.colors.accent,
    ['--school-erp-page' as string]: cfg.colors.background,
    ['--school-erp-card' as string]: cfg.colors.surface,
    ['--school-erp-border' as string]: cfg.colors.border,
    ['--school-erp-text' as string]: cfg.colors.text,
    ['--school-erp-muted' as string]: cfg.colors.muted,
    ['--school-erp-sidebar-width' as string]: `${extras?.sidebarWidth ?? cfg.sidebar.width}px`,
    ['--primary' as string]: primary,
    ['--secondary' as string]: cfg.colors.secondary,
    ['--accent' as string]: cfg.colors.accent,
    ['--background' as string]: cfg.colors.background,
    ['--foreground' as string]: cfg.colors.text,
    ['--surface' as string]: cfg.colors.surface,
    ['--card' as string]: cfg.colors.surface,
    ['--border' as string]: cfg.colors.border,
    ['--muted' as string]: cfg.colors.muted,
    ['--success' as string]: cfg.colors.success,
    ['--warning' as string]: cfg.colors.warning,
    ['--danger' as string]: cfg.colors.danger,
    ['--radius' as string]: `${extras?.radius ?? cfg.components.cardRadius}px`,
    fontFamily: extras?.fontFamily || cfg.typography.fontFamily,
  } as CSSProperties;
}
