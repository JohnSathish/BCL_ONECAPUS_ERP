import type { AppThemeSettings } from '@/types/branding';
import { getPreset } from './default-themes';
import { hexToHslComponents, mixHex, roundedStyleToPx, shadowForIntensity } from './theme-utils';

export type CssVariableMap = Record<string, string>;

function hslOrFallback(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  return hexToHslComponents(hex) ?? fallback;
}

const ALL_THEME_VAR_KEYS = [
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-muted',
  '--sidebar-border',
  '--sidebar-active-bg',
  '--sidebar-bg',
  '--sidebar-text',
  '--topbar-bg',
  '--header-bg',
  '--header-text',
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--card-bg',
  '--card-border',
  '--card-shadow',
  '--card-padding',
  '--primary',
  '--primary-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--ring',
  '--muted',
  '--muted-foreground',
  '--success',
  '--warning',
  '--danger',
  '--table-header-bg',
  '--table-row-hover',
  '--table-border',
  '--table-row-py',
  '--table-font-size',
  '--button-primary-bg',
  '--button-primary-hover',
  '--button-secondary-bg',
  '--button-destructive-bg',
  '--gradient-start',
  '--gradient-end',
  '--radius',
  '--shadow-soft',
  '--font-scale',
  '--font-family',
  '--glass',
  '--glass-opacity',
  '--transition-duration',
  '--institution-primary',
  '--institution-accent',
  '--institution-sidebar',
  '--login-institution-primary',
  '--login-institution-accent',
] as const;

/** Build CSS variable map from merged theme settings. */
export function themeToCssVariables(theme: AppThemeSettings, isDark = false): CssVariableMap {
  const preset = getPreset(theme.themeName);
  const primary = theme.primaryColor ?? preset.primaryColor;
  const accent = theme.accentColor ?? preset.accentColor;
  const sidebarBg = theme.sidebarBg ?? preset.sidebarBg;
  const sidebarText = theme.sidebarText ?? preset.sidebarText;
  const sidebarActive = theme.sidebarActive ?? preset.sidebarActive;
  const topbarBg = theme.topbarBg ?? preset.topbarBg;
  const cardBg = theme.cardBg ?? preset.cardBg;
  const borderColor = theme.borderColor ?? preset.borderColor;
  const layout = { ...preset.layout, ...(theme.layoutJson ?? {}) };

  const success = preset.successColor ?? '#16a34a';
  const warning = preset.warningColor ?? '#d97706';
  const error = preset.errorColor ?? '#dc2626';

  const sidebarHsl = hslOrFallback(sidebarBg, isDark ? '222 47% 6%' : '222 47% 11%');
  const sidebarFg = hslOrFallback(sidebarText, isDark ? '210 40% 96%' : '210 40% 96%');
  const sidebarMuted = hslOrFallback(mixHex(sidebarText, sidebarBg, 0.45), '215 20% 65%');
  const sidebarBorder = hslOrFallback(mixHex(sidebarBg, '#000000', 0.15), '217 33% 22%');
  const sidebarActiveHsl = hslOrFallback(sidebarActive, '221 83% 53%');

  const primaryHsl = hslOrFallback(primary, '221 83% 53%');
  const accentHsl = hslOrFallback(accent, '262 83% 58%');
  const topbarHsl = hslOrFallback(topbarBg, isDark ? '222 84% 4%' : '210 40% 98%');
  const cardHsl = hslOrFallback(cardBg, isDark ? '217 33% 12%' : '0 0% 100%');
  const borderHsl = hslOrFallback(borderColor, isDark ? '217 33% 20%' : '214 32% 91%');
  const mutedHsl = isDark ? '217 33% 17%' : '210 40% 96%';
  const mutedFgHsl = isDark ? '215 20% 65%' : '215 16% 47%';

  const headerTextHex = layout.headerTextColor ?? (isDark ? '#f8fafc' : '#0f172a');
  const headerTextHsl = hslOrFallback(headerTextHex, isDark ? '210 40% 98%' : '222 47% 11%');

  const buttonPrimaryHoverHex = layout.buttonPrimaryHover ?? mixHex(primary, '#000000', 0.12);
  const buttonSecondaryHex = layout.buttonSecondaryBg ?? (isDark ? '#334155' : '#f1f5f9');
  const buttonDestructiveHex = layout.buttonDestructiveBg ?? error;

  const tableHeaderHex = layout.tableHeaderBg ?? mixHex(cardBg, borderColor, 0.35);
  const tableRowHoverHex = layout.tableRowHover ?? mixHex(cardBg, primary, 0.06);

  const cardDensity = layout.cardDensity ?? 'comfortable';
  const tableDensity = layout.tableDensity ?? 'comfortable';
  const glassEnabled = layout.glassEnabled !== false;

  const fontFamily = theme.fontFamily?.trim() || 'var(--font-geist-sans), system-ui, sans-serif';

  return {
    '--sidebar': sidebarHsl,
    '--sidebar-foreground': sidebarFg,
    '--sidebar-muted': sidebarMuted,
    '--sidebar-border': sidebarBorder,
    '--sidebar-active-bg': sidebarActiveHsl,
    '--sidebar-bg': sidebarHsl,
    '--sidebar-text': sidebarFg,
    '--topbar-bg': topbarHsl,
    '--header-bg': topbarHsl,
    '--header-text': headerTextHsl,
    '--background': isDark ? '222 84% 4%' : topbarHsl,
    '--foreground': isDark ? '210 40% 98%' : '222 47% 11%',
    '--card': cardHsl,
    '--card-foreground': isDark ? '210 40% 98%' : '222 47% 11%',
    '--card-bg': cardHsl,
    '--card-border': borderHsl,
    '--card-shadow': shadowForIntensity(layout.shadowIntensity ?? 'soft'),
    '--card-padding': layout.spaciousMode
      ? '1.5rem'
      : cardDensity === 'compact'
        ? '0.75rem'
        : '1.25rem',
    '--primary': primaryHsl,
    '--primary-foreground': '210 40% 98%',
    '--accent': accentHsl,
    '--accent-foreground': '210 40% 98%',
    '--border': borderHsl,
    '--ring': primaryHsl,
    '--muted': mutedHsl,
    '--muted-foreground': mutedFgHsl,
    '--success': hslOrFallback(success, '142 76% 36%'),
    '--warning': hslOrFallback(warning, '38 92% 50%'),
    '--danger': hslOrFallback(error, '0 84% 60%'),
    '--table-header-bg': hslOrFallback(tableHeaderHex, mutedHsl),
    '--table-row-hover': hslOrFallback(tableRowHoverHex, mutedHsl),
    '--table-border': borderHsl,
    '--table-row-py': tableDensity === 'compact' ? '0.375rem' : '0.625rem',
    '--table-font-size': tableDensity === 'compact' ? '0.8125rem' : '0.875rem',
    '--button-primary-bg': primaryHsl,
    '--button-primary-hover': hslOrFallback(buttonPrimaryHoverHex, primaryHsl),
    '--button-secondary-bg': hslOrFallback(buttonSecondaryHex, mutedHsl),
    '--button-destructive-bg': hslOrFallback(buttonDestructiveHex, '0 84% 60%'),
    '--gradient-start': primaryHsl,
    '--gradient-end': accentHsl,
    '--radius': roundedStyleToPx(theme.roundedStyle ?? preset.roundedStyle),
    '--shadow-soft': shadowForIntensity(layout.shadowIntensity ?? 'soft'),
    '--font-scale': layout.spaciousMode ? '1.03' : cardDensity === 'compact' ? '0.95' : '1',
    '--font-family': fontFamily,
    '--glass': glassEnabled
      ? isDark
        ? '217 33% 12% / 0.65'
        : '0 0% 100% / 0.72'
      : isDark
        ? '217 33% 12% / 1'
        : '0 0% 100% / 1',
    '--glass-opacity': glassEnabled ? '0.72' : '1',
    '--transition-duration': '150ms',
    '--institution-primary': primary,
    '--institution-accent': accent,
    '--institution-sidebar': sidebarBg,
    '--login-institution-primary': primary,
    '--login-institution-accent': accent,
  };
}

export function applyCssVariablesToRoot(
  vars: CssVariableMap,
  root: HTMLElement = document.documentElement,
) {
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function applyThemeDomClasses(
  theme: AppThemeSettings,
  root: HTMLElement = document.documentElement,
) {
  const layout = { ...getPreset(theme.themeName).layout, ...(theme.layoutJson ?? {}) };
  root.classList.toggle('theme-glass-disabled', layout.glassEnabled === false);
}

const CUSTOM_CSS_ID = 'erp-theme-custom-css';

export function applyCustomCss(css: string | undefined, enabled: boolean) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(CUSTOM_CSS_ID) as HTMLStyleElement | null;
  if (!enabled || !css?.trim()) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = CUSTOM_CSS_ID;
    el.setAttribute('data-theme-custom', 'true');
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function withThemeTransition(apply: () => void) {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  apply();
  window.setTimeout(() => root.classList.remove('theme-transition'), 150);
}

export function clearInstitutionThemeVars(root: HTMLElement = document.documentElement) {
  for (const key of ALL_THEME_VAR_KEYS) {
    root.style.removeProperty(key);
  }
  root.classList.remove('institution-branded', 'theme-glass-disabled', 'theme-transition');
  document.getElementById(CUSTOM_CSS_ID)?.remove();
}

export const THEME_CACHE_KEY = 'erp-theme-cache-v1';

export function cacheThemePayload(tenantId: string, theme: AppThemeSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      THEME_CACHE_KEY,
      JSON.stringify({ tenantId, theme, cachedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function readCachedTheme(tenantId: string): AppThemeSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tenantId: string; theme: AppThemeSettings };
    if (parsed.tenantId !== tenantId) return null;
    return parsed.theme;
  } catch {
    return null;
  }
}

/** Inline script body for layout.tsx FOUC prevention */
export const THEME_FOUC_SCRIPT = `
(function(){
  try {
    var k='erp-theme-cache-v1';
    var r=localStorage.getItem(k);
    if(!r)return;
    var p=JSON.parse(r);
    var t=p.theme;
    if(!t)return;
    var d=document.documentElement;
    d.classList.add('institution-branded');
    function hexToHsl(hex){
      hex=hex.replace('#','');
      if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      var r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;
      var max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2;
      if(max!==min){var dd=max-min;s=l>0.5?dd/(2-max-min):dd/(max+min);
        switch(max){case r:h=((g-b)/dd+(g<b?6:0))/6;break;case g:h=((b-r)/dd+2)/6;break;default:h=((r-g)/dd+4)/6;}
      }
      return Math.round(h*360)+' '+Math.round(s*100)+'% '+Math.round(l*100)+'%';
    }
    if(t.sidebarBg){d.style.setProperty('--sidebar',hexToHsl(t.sidebarBg));d.style.setProperty('--sidebar-bg',hexToHsl(t.sidebarBg));}
    if(t.sidebarText){d.style.setProperty('--sidebar-foreground',hexToHsl(t.sidebarText));d.style.setProperty('--sidebar-text',hexToHsl(t.sidebarText));}
    if(t.sidebarActive)d.style.setProperty('--sidebar-active-bg',hexToHsl(t.sidebarActive));
    if(t.topbarBg){d.style.setProperty('--topbar-bg',hexToHsl(t.topbarBg));d.style.setProperty('--header-bg',hexToHsl(t.topbarBg));}
    if(t.cardBg)d.style.setProperty('--card',hexToHsl(t.cardBg));
    if(t.primaryColor){
      d.style.setProperty('--institution-primary',t.primaryColor);
      d.style.setProperty('--login-institution-primary',t.primaryColor);
      d.style.setProperty('--primary',hexToHsl(t.primaryColor));
      d.style.setProperty('--button-primary-bg',hexToHsl(t.primaryColor));
    }
    if(t.accentColor){
      d.style.setProperty('--institution-accent',t.accentColor);
      d.style.setProperty('--login-institution-accent',t.accentColor);
    }
    if(t.sidebarBg)d.style.setProperty('--institution-sidebar',t.sidebarBg);
    d.style.setProperty('--transition-duration','150ms');
  } catch(e){}
})();
`;
