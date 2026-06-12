/** Parse #rgb or #rrggbb to HSL components string for CSS vars: "H S% L%" */
export function hexToHslComponents(hex: string): string | null {
  const normalized = hex.trim().replace('#', '');
  if (![3, 6].includes(normalized.length)) return null;

  let r: number;
  let g: number;
  let b: number;

  if (normalized.length === 3) {
    r = parseInt(normalized[0]! + normalized[0]!, 16) / 255;
    g = parseInt(normalized[1]! + normalized[1]!, 16) / 255;
    b = parseInt(normalized[2]! + normalized[2]!, 16) / 255;
  } else {
    r = parseInt(normalized.slice(0, 2), 16) / 255;
    g = parseInt(normalized.slice(2, 4), 16) / 255;
    b = parseInt(normalized.slice(4, 6), 16) / 255;
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function mixHex(base: string, mix: string, weight = 0.5): string {
  const parse = (hex: string) => {
    const n = hex.replace('#', '');
    const full =
      n.length === 3
        ? n
            .split('')
            .map((c) => c + c)
            .join('')
        : n;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ] as const;
  };
  const [r1, g1, b1] = parse(base);
  const [r2, g2, b2] = parse(mix);
  const w = Math.min(1, Math.max(0, weight));
  const r = Math.round(r1 * (1 - w) + r2 * w);
  const g = Math.round(g1 * (1 - w) + g2 * w);
  const b = Math.round(b1 * (1 - w) + b2 * w);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function roundedStyleToPx(style: string): string {
  switch (style) {
    case 'sm':
      return '0.375rem';
    case 'md':
      return '0.5rem';
    case 'lg':
      return '0.75rem';
    case 'xl':
      return '1rem';
    case '2xl':
      return '1.25rem';
    default:
      return '1rem';
  }
}

export function shadowForIntensity(intensity: 'soft' | 'medium' | 'strong'): string {
  switch (intensity) {
    case 'medium':
      return '0 4px 24px hsl(222 47% 11% / 0.12)';
    case 'strong':
      return '0 8px 40px hsl(222 47% 11% / 0.18)';
    default:
      return '0 1px 2px hsl(222 47% 11% / 0.04), 0 8px 24px hsl(222 47% 11% / 0.06)';
  }
}
