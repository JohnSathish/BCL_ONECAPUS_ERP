/** Shared CR80 print/preview typography — sized for PVC legibility at arm's length */

export type IdCardTypeScale = {
  /** Student / staff full name */
  name: string;
  /** Role label (STUDENT) */
  role: string;
  /** Department subtitle under name */
  subtitle: string;
  /** Detail row label (Reg No, etc.) */
  label: string;
  /** Detail row value */
  value: string;
  /** College name in header */
  header: string;
  /** Motto / location under college name */
  headerSub: string;
  /** Validity pill caption */
  validityCaption: string;
  /** Validity date */
  validityDate: string;
  /** Verify URL / terms body */
  fine: string;
  /** IMPORTANT heading */
  termsTitle: string;
  /** Contact line text */
  contact: string;
  /** Address block */
  address: string;
};

/** Default Pursuit Excellence scale (print = pt, screen mirrors via px ≈ pt in CR80 CSS). */
export const PURSUIT_TYPE_SCALE: IdCardTypeScale = {
  name: '10.5pt',
  role: '5.5pt',
  subtitle: '5pt',
  label: '5pt',
  value: '6.2pt',
  header: '7.5pt',
  headerSub: '3.8pt',
  validityCaption: '3.6pt',
  validityDate: '5.8pt',
  fine: '3.8pt',
  termsTitle: '4.5pt',
  contact: '4.2pt',
  address: '5pt',
};

/** Screen Tailwind-ish sizes (px) matching print pt for preview. */
export const PURSUIT_TYPE_SCALE_PX = {
  name: '10.5px',
  role: '5.5px',
  subtitle: '5px',
  label: '5px',
  value: '6.2px',
  header: '7.5px',
  headerSub: '3.8px',
  validityCaption: '3.6px',
  validityDate: '5.8px',
  fine: '3.8px',
  termsTitle: '4.5px',
  contact: '4.2px',
  address: '5px',
} as const;

/**
 * Designer `style.fontSize` is treated as the detail-value size in pt.
 * Scale other roles proportionally from the default value size (6.2).
 */
export function scalePursuitType(
  overridePt?: number | null,
  base: IdCardTypeScale = PURSUIT_TYPE_SCALE,
): IdCardTypeScale {
  if (overridePt == null || !Number.isFinite(overridePt) || overridePt <= 0) {
    return base;
  }
  const factor = overridePt / 6.2;
  const scale = (pt: string) => {
    const n = parseFloat(pt);
    if (!Number.isFinite(n)) return pt;
    return `${Math.round(n * factor * 10) / 10}pt`;
  };
  return {
    name: scale(base.name),
    role: scale(base.role),
    subtitle: scale(base.subtitle),
    label: scale(base.label),
    value: scale(base.value),
    header: scale(base.header),
    headerSub: scale(base.headerSub),
    validityCaption: scale(base.validityCaption),
    validityDate: scale(base.validityDate),
    fine: scale(base.fine),
    termsTitle: scale(base.termsTitle),
    contact: scale(base.contact),
    address: scale(base.address),
  };
}

export function scaleToPx(scale: IdCardTypeScale): Record<keyof IdCardTypeScale, string> {
  const toPx = (pt: string) => pt.replace('pt', 'px');
  return {
    name: toPx(scale.name),
    role: toPx(scale.role),
    subtitle: toPx(scale.subtitle),
    label: toPx(scale.label),
    value: toPx(scale.value),
    header: toPx(scale.header),
    headerSub: toPx(scale.headerSub),
    validityCaption: toPx(scale.validityCaption),
    validityDate: toPx(scale.validityDate),
    fine: toPx(scale.fine),
    termsTitle: toPx(scale.termsTitle),
    contact: toPx(scale.contact),
    address: toPx(scale.address),
  };
}

/** Library revision — bump when default Pursuit layout should refresh for tenants. */
export const PURSUIT_EXCELLENCE_LAYOUT_REVISION = 2;
