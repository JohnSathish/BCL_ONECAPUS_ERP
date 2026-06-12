import type { IdCardFieldKey, IdCardLayoutV1 } from '@/types/id-card-template';
import type { IdCardModel } from '@/types/id-card';
import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';
import { normalizeIdCardLayout } from './layout-legacy-migrate';
import type { EvolisFeedOptions, PrintCalibration } from './cr80-designer-constants';
import { renderFieldHtml } from './id-card-field-content';
import { idCardFieldOverflow } from './id-card-field-overflow';
import { backgroundPrintHtml, backgroundForSide } from './id-card-background-utils';

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
  photoShape?: 'square' | 'circle',
  signatureUrl?: string | null,
  side?: 'front' | 'back',
): string {
  return renderFieldHtml(fieldKey, {
    model,
    primary,
    accent,
    stylePreset: layout.meta?.stylePreset,
    photoShape,
    signatureUrl,
    side,
  });
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
    .filter((el) => el.style?.visible !== false && el.fieldKey)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((el) => {
      const html = fieldHtml(
        el.fieldKey as IdCardFieldKey,
        model,
        primary,
        accent,
        resolved,
        el.style?.photoShape,
        signatureUrl,
        side,
      );
      if (!html) return '';
      const overflow = idCardFieldOverflow(el.fieldKey);
      return `<div style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.width}mm;height:${el.height}mm;overflow:${overflow};z-index:${el.zIndex ?? 1};text-align:${el.style?.align ?? 'center'};">${html}</div>`;
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

  const frontBody = sideHtml(
    options.model,
    options.layout,
    'front',
    options.holderType,
    options.testMode,
    options.signatureUrl,
  );
  const backBody = sideHtml(
    options.model,
    options.layout,
    'back',
    options.holderType,
    options.testMode,
    options.signatureUrl,
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
