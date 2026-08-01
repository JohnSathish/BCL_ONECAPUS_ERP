import type {
  IdCardElement,
  IdCardFieldKey,
  IdCardLayoutV1,
  IdCardPhotoShape,
} from '@/types/id-card-template';
import type { IdCardModel } from '@/types/id-card';
import { resolveUploadAssetUrlForPrint } from '@/lib/branding-asset';
import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';
import { normalizeIdCardLayout } from './layout-legacy-migrate';
import type { EvolisFeedOptions, PrintCalibration } from './cr80-designer-constants';
import { renderFieldHtml, escHtml } from './id-card-field-content';
import { idCardFieldOverflow } from './id-card-field-overflow';
import { backgroundPrintHtml, backgroundForSide } from './id-card-background-utils';
import {
  elementChromeStyleHtml,
  elementFieldChromeStyleHtml,
  fieldLabelCaptionHtml,
  renderShapeHtml,
  renderStaticTextHtml,
} from './id-card-element-style';

/** Remap browser same-origin upload URLs to Nest for Puppeteer. */
function modelForPrint(model: IdCardModel): IdCardModel {
  const institution = {
    ...model.institution,
    logoUrl: resolveUploadAssetUrlForPrint(model.institution.logoUrl) ?? model.institution.logoUrl,
  };
  if (model.cardType === 'student') {
    return {
      ...model,
      institution,
      holder: {
        ...model.holder,
        photoUrl: resolveUploadAssetUrlForPrint(model.holder.photoUrl) ?? model.holder.photoUrl,
      },
    };
  }
  return {
    ...model,
    institution,
    holder: {
      ...model.holder,
      photoUrl: resolveUploadAssetUrlForPrint(model.holder.photoUrl) ?? model.holder.photoUrl,
    },
  };
}

export type Cr80PrintPurpose = 'preview' | 'evolis';

export type Cr80PrintMeta = {
  widthMm: number;
  heightMm: number;
  orientation: 'Portrait' | 'Landscape';
  frontRotationDeg: number;
  backRotationDeg: number;
  purpose: Cr80PrintPurpose;
  evolisFeedApplied: boolean;
};

function fieldHtml(
  fieldKey: IdCardFieldKey,
  model: IdCardModel,
  primary: string,
  accent: string,
  layout: IdCardLayoutV1,
  photoShape?: IdCardPhotoShape,
  signatureUrl?: string | null,
  side?: 'front' | 'back',
  fontSize?: number | null,
  showLabel?: boolean,
): string {
  return renderFieldHtml(fieldKey, {
    model,
    primary,
    accent,
    stylePreset: layout.meta?.stylePreset,
    photoShape,
    signatureUrl,
    side,
    fontSize,
    showLabel,
  });
}

function elementPrintInner(
  el: IdCardElement,
  model: IdCardModel,
  primary: string,
  accent: string,
  layout: IdCardLayoutV1,
  signatureUrl?: string | null,
  side?: 'front' | 'back',
): string {
  if (el.type === 'shape') return renderShapeHtml(el);
  if (el.type === 'text') return renderStaticTextHtml(el);
  if (!el.fieldKey) return '';
  const html = fieldHtml(
    el.fieldKey as IdCardFieldKey,
    model,
    primary,
    accent,
    layout,
    el.style?.photoShape,
    signatureUrl,
    side,
    el.style?.fontSize,
    el.binding?.showLabel,
  );
  if (!html) return '';
  const prefix = el.binding?.prefix
    ? `<span style="font-size:0.85em;opacity:0.8;">${escHtml(el.binding.prefix)}</span>`
    : '';
  const suffix = el.binding?.suffix
    ? `<span style="font-size:0.85em;opacity:0.8;">${escHtml(el.binding.suffix)}</span>`
    : '';
  const caption = fieldLabelCaptionHtml(el);
  if (prefix || suffix) {
    return `${caption}<div style="display:flex;align-items:center;justify-content:center;gap:0.5mm;width:100%;height:100%;overflow:hidden;">${prefix}<div style="flex:1;min-width:0;overflow:hidden;">${html}</div>${suffix}</div>`;
  }
  return `${caption}${html}`;
}

function sideHtml(
  model: IdCardModel,
  layout: IdCardLayoutV1,
  side: 'front' | 'back',
  holderType?: string,
  testMode?: boolean,
  signatureUrl?: string | null,
): string {
  const primary = model.institution.primaryColor;
  const accent = model.institution.accentColor;
  const resolved = normalizeIdCardLayout(
    layout,
    holderType ?? (model.cardType === 'staff' ? 'STAFF' : 'STUDENT'),
  );
  const elements = side === 'front' ? resolved.front : resolved.back;
  const background = backgroundForSide(resolved, side);

  const backgroundLayer = background ? backgroundPrintHtml(background) : '';

  const fields = [...elements]
    .filter((el) => el.style?.visible !== false)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((el) => {
      const html = elementPrintInner(el, model, primary, accent, resolved, signatureUrl, side);
      if (!html) return '';
      const overflow = el.type === 'field' ? idCardFieldOverflow(el.fieldKey) : 'hidden';
      const chrome =
        el.type === 'field'
          ? elementFieldChromeStyleHtml(el.style)
          : elementChromeStyleHtml(el.style);
      const styleBits = [
        `position:absolute`,
        `left:${el.x}mm`,
        `top:${el.y}mm`,
        `width:${el.width}mm`,
        `height:${el.height}mm`,
        `overflow:${overflow}`,
        `z-index:${el.zIndex ?? 1}`,
        chrome,
      ].filter(Boolean);
      return `<div style="${styleBits.join(';')};">${html}</div>`;
    })
    .join('');

  const testOverlay = testMode
    ? `<div style="position:absolute;inset:0;border:0.5mm dashed #ef4444;pointer-events:none;"></div>
       <div style="position:absolute;left:0;top:0;width:3mm;height:3mm;background:#ef4444;"></div>
       <div style="position:absolute;right:0;top:0;width:3mm;height:3mm;background:#ef4444;"></div>
       <div style="position:absolute;left:0;bottom:0;width:3mm;height:3mm;background:#ef4444;"></div>
       <div style="position:absolute;right:0;bottom:0;width:3mm;height:3mm;background:#ef4444;"></div>`
    : '';

  return `<div class="cr80-face" style="position:relative;width:${CR80_WIDTH_MM}mm;height:${CR80_HEIGHT_MM}mm;overflow:hidden;background:#fff;font-family:Arial,sans-serif;">${backgroundLayer}${fields}${testOverlay}</div>`;
}

function rotationStyle(deg: number): string {
  if (!deg) return '';
  return `transform:rotate(${deg}deg);transform-origin:center center;`;
}

function offsetWrap(body: string, calibration?: PrintCalibration, rotationDeg = 0): string {
  const top = calibration?.topOffsetMm ?? 0;
  const right = calibration?.rightOffsetMm ?? 0;
  const bottom = calibration?.bottomOffsetMm ?? 0;
  const left = calibration?.leftOffsetMm ?? 0;
  const rotate = rotationStyle(rotationDeg);
  return `<div class="cr80-page" style="width:${CR80_WIDTH_MM}mm;height:${CR80_HEIGHT_MM}mm;overflow:hidden;page-break-after:always;box-sizing:border-box;">
    <div style="width:100%;height:100%;padding:${top}mm ${right}mm ${bottom}mm ${left}mm;box-sizing:border-box;${rotate}">
      <div style="position:relative;width:100%;height:100%;">${body.replace(
        `width:${CR80_WIDTH_MM}mm;height:${CR80_HEIGHT_MM}mm`,
        'width:100%;height:100%',
      )}</div>
    </div>
  </div>`;
}

export function buildCr80PrintDocument(options: {
  model: IdCardModel;
  layout: IdCardLayoutV1;
  holderType?: string;
  calibration?: PrintCalibration;
  evolisFeed?: EvolisFeedOptions;
  purpose?: Cr80PrintPurpose;
  testMode?: boolean;
  signatureUrl?: string | null;
}): { frontHtml: string; backHtml: string; meta: Cr80PrintMeta } {
  const purpose = options.purpose ?? 'preview';
  const applyEvolisFeed = purpose === 'evolis' && options.evolisFeed;
  const frontRotationDeg = applyEvolisFeed && options.evolisFeed?.rotateFront180 ? 180 : 0;
  const backRotationDeg = applyEvolisFeed && options.evolisFeed?.rotateBack180 ? 180 : 0;

  const printModel = modelForPrint(options.model);
  const signatureUrl =
    resolveUploadAssetUrlForPrint(options.signatureUrl) ?? options.signatureUrl ?? null;

  const frontBody = sideHtml(
    printModel,
    options.layout,
    'front',
    options.holderType,
    options.testMode,
    signatureUrl,
  );
  const backBody = sideHtml(
    printModel,
    options.layout,
    'back',
    options.holderType,
    options.testMode,
    signatureUrl,
  );

  const meta: Cr80PrintMeta = {
    widthMm: CR80_WIDTH_MM,
    heightMm: CR80_HEIGHT_MM,
    orientation: CR80_HEIGHT_MM > CR80_WIDTH_MM ? 'Portrait' : 'Landscape',
    frontRotationDeg,
    backRotationDeg,
    purpose,
    evolisFeedApplied: frontRotationDeg !== 0 || backRotationDeg !== 0,
  };

  return {
    frontHtml: offsetWrap(frontBody, options.calibration, frontRotationDeg),
    backHtml: offsetWrap(backBody, options.calibration, backRotationDeg),
    meta,
  };
}

export function buildCr80PrintHtmlDocument(frontHtml: string, backHtml: string): string {
  return buildBulkCr80PrintHtmlDocument([frontHtml, backHtml]);
}

export function buildBulkCr80PrintHtmlDocument(pages: string[]): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { size: ${CR80_WIDTH_MM}mm ${CR80_HEIGHT_MM}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .cr80-page { box-sizing: border-box; }
    * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  </style></head><body>${pages.join('')}</body></html>`;
}
