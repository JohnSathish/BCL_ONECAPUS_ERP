import type { CSSProperties } from 'react';
import type { AppearanceConfig } from '@/lib/school-sis/appearance';
import { appearanceToCssVars } from '@/lib/school-sis/theme-tokens';

export function appearanceCssVars(
  cfg: AppearanceConfig | undefined,
  extras?: { sidebarWidth?: number; fontFamily?: string; radius?: number; themeId?: string },
): CSSProperties {
  return appearanceToCssVars(cfg, extras);
}
