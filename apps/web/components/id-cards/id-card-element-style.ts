import type { CSSProperties } from 'react';
import type {
  IdCardElement,
  IdCardElementBinding,
  IdCardElementStyle,
  IdCardShadow,
  IdCardTextTransform,
} from '@/types/id-card-template';
import { getFieldDisplayName } from './id-card-element-catalog';

export function fontWeightCss(
  weight: IdCardElementStyle['fontWeight'] | undefined,
): string | undefined {
  switch (weight) {
    case 'normal':
      return '400';
    case 'medium':
      return '500';
    case 'semibold':
      return '600';
    case 'bold':
      return '700';
    case 'extrabold':
      return '800';
    default:
      return undefined;
  }
}

export function shadowCss(shadow: IdCardShadow | undefined): string | undefined {
  switch (shadow) {
    case 'sm':
      return '0 1px 2px rgba(0,0,0,0.18)';
    case 'md':
      return '0 2px 6px rgba(0,0,0,0.22)';
    default:
      return undefined;
  }
}

export function photoBorderRadius(shape: IdCardElementStyle['photoShape'] | undefined): string {
  if (shape === 'circle') return '50%';
  if (shape === 'rounded') return '2.5mm';
  return '1.2mm';
}

export function applyTextTransform(value: string, transform?: IdCardTextTransform): string {
  if (!transform || transform === 'none') return value;
  if (transform === 'uppercase') return value.toUpperCase();
  if (transform === 'lowercase') return value.toLowerCase();
  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function applyBindingToPlainText(
  value: string,
  binding?: IdCardElementBinding | null,
): string {
  let v = value ?? '';
  if (
    binding?.characterLimit != null &&
    binding.characterLimit > 0 &&
    v.length > binding.characterLimit
  ) {
    v = `${v.slice(0, binding.characterLimit)}…`;
  }
  v = applyTextTransform(v, binding?.textTransform);
  const prefix = binding?.prefix ?? '';
  const suffix = binding?.suffix ?? '';
  return `${prefix}${v}${suffix}`;
}

export function cssTextTransform(transform?: IdCardTextTransform): string | undefined {
  if (!transform || transform === 'none' || transform === 'titlecase') return undefined;
  return transform;
}

/** Shared box styles for designer preview + print HTML.
 * `style.fontSize` is always pt (matches Properties panel and PVC print). */
export function elementChromeStyle(style?: IdCardElementStyle): CSSProperties {
  const borderWidth = style?.borderWidthMm;
  const borderColor = style?.borderColor;
  return {
    textAlign: style?.align ?? 'center',
    fontSize: style?.fontSize ? `${style.fontSize}pt` : undefined,
    fontWeight: fontWeightCss(style?.fontWeight),
    fontFamily: style?.fontFamily || undefined,
    fontStyle: style?.fontStyle === 'italic' ? 'italic' : undefined,
    textDecoration: style?.textDecoration === 'underline' ? 'underline' : undefined,
    letterSpacing: style?.letterSpacing != null ? `${style.letterSpacing}px` : undefined,
    lineHeight: style?.lineHeight != null ? String(style.lineHeight) : undefined,
    color: style?.color,
    backgroundColor: style?.backgroundColor,
    opacity: style?.opacity,
    padding: style?.paddingMm != null ? `${style.paddingMm}mm` : undefined,
    borderRadius: style?.borderRadiusMm != null ? `${style.borderRadiusMm}mm` : undefined,
    boxShadow: shadowCss(style?.shadow),
    transform: style?.rotationDeg ? `rotate(${style.rotationDeg}deg)` : undefined,
    border: borderWidth && borderColor ? `${borderWidth}mm solid ${borderColor}` : undefined,
    boxSizing: 'border-box',
  };
}

/** Box/layout chrome for dynamic fields — fontSize drives Pursuit scale, not CSS wrapper size. */
export function elementFieldChromeStyle(style?: IdCardElementStyle): CSSProperties {
  return elementChromeStyle(style ? { ...style, fontSize: undefined } : undefined);
}

export function elementChromeStyleHtml(style?: IdCardElementStyle): string {
  const bits: string[] = [];
  if (style?.align) bits.push(`text-align:${style.align}`);
  if (style?.fontSize) bits.push(`font-size:${style.fontSize}pt`);
  const fw = fontWeightCss(style?.fontWeight);
  if (fw) bits.push(`font-weight:${fw}`);
  if (style?.fontFamily) {
    // Use single quotes so we never break HTML style="..." attributes.
    const safe = style.fontFamily.replace(/['"]/g, '').trim();
    if (safe) bits.push(`font-family:'${safe}'`);
  }
  if (style?.fontStyle === 'italic') bits.push('font-style:italic');
  if (style?.textDecoration === 'underline') bits.push('text-decoration:underline');
  if (style?.letterSpacing != null) bits.push(`letter-spacing:${style.letterSpacing}px`);
  if (style?.lineHeight != null) bits.push(`line-height:${style.lineHeight}`);
  if (style?.color) bits.push(`color:${cssColor(style.color)}`);
  if (style?.backgroundColor) bits.push(`background-color:${cssColor(style.backgroundColor)}`);
  if (style?.opacity != null && Number.isFinite(style.opacity))
    bits.push(`opacity:${style.opacity}`);
  if (style?.paddingMm != null) bits.push(`padding:${style.paddingMm}mm`);
  if (style?.borderRadiusMm != null) bits.push(`border-radius:${style.borderRadiusMm}mm`);
  const sh = shadowCss(style?.shadow);
  if (sh) bits.push(`box-shadow:${sh}`);
  if (style?.rotationDeg) bits.push(`transform:rotate(${style.rotationDeg}deg)`);
  if (style?.borderWidthMm && style?.borderColor) {
    bits.push(`border:${style.borderWidthMm}mm solid ${cssColor(style.borderColor)}`);
  }
  bits.push('box-sizing:border-box');
  return bits.join(';');
}

export function elementFieldChromeStyleHtml(style?: IdCardElementStyle): string {
  return elementChromeStyleHtml(style ? { ...style, fontSize: undefined } : undefined);
}

function cssColor(value: string): string {
  // Only allow simple color tokens in inline styles (hex / rgb / named).
  const v = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v;
  if (/^rgba?\([\d\s.,%]+\)$/.test(v)) return v;
  if (/^[a-zA-Z]+$/.test(v)) return v;
  return '#0f172a';
}

export function renderShapeHtml(element: IdCardElement): string {
  const kind = element.shapeKind ?? 'rectangle';
  const fill =
    element.style?.backgroundColor ??
    (kind === 'line' || kind === 'divider' ? '#0f172a' : '#e2e8f0');
  const stroke = element.style?.borderColor;
  const strokeW = element.style?.borderWidthMm ?? 0;
  const opacity = element.style?.opacity ?? 1;
  const radius = element.style?.borderRadiusMm ?? (kind === 'circle' ? 999 : 0);

  if (kind === 'line' || kind === 'divider') {
    const thickness = Math.max(0.2, element.height);
    return `<div style="width:100%;height:100%;display:flex;align-items:center;opacity:${opacity};"><div style="width:100%;height:${thickness}mm;background:${fill};border-radius:${radius}mm;"></div></div>`;
  }
  if (kind === 'circle') {
    return `<div style="width:100%;height:100%;border-radius:50%;background:${fill};opacity:${opacity};${strokeW && stroke ? `border:${strokeW}mm solid ${stroke};` : ''}box-sizing:border-box;"></div>`;
  }
  return `<div style="width:100%;height:100%;border-radius:${radius}mm;background:${fill};opacity:${opacity};${strokeW && stroke ? `border:${strokeW}mm solid ${stroke};` : ''}box-sizing:border-box;"></div>`;
}

export function renderStaticTextHtml(element: IdCardElement): string {
  const raw = element.content ?? element.label ?? 'Text';
  const text = applyBindingToPlainText(raw, element.binding);
  const label =
    element.binding?.showLabel && element.label
      ? `<div style="font-size:0.7em;opacity:0.7;margin-bottom:0.2mm;">${escapeHtml(element.label)}</div>`
      : '';
  return `${label}<div style="width:100%;height:100%;overflow:hidden;word-break:break-word;">${escapeHtml(text)}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fieldLabelCaptionHtml(element: IdCardElement): string {
  if (!element.binding?.showLabel) return '';
  const name = getFieldDisplayName(element.fieldKey, element.label);
  return `<div style="font-size:0.7em;opacity:0.7;margin-bottom:0.2mm;text-align:inherit;">${escapeHtml(name)}</div>`;
}
