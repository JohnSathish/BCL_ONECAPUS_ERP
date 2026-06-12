import type { IdCardModel } from '@/types/id-card';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import {
  buildCr80PrintDocument,
  buildCr80PrintHtmlDocument,
  type Cr80PrintPurpose,
} from './build-cr80-print-html';
import type { EvolisFeedOptions, PrintCalibration } from './cr80-designer-constants';
import { renderIdCardPdf } from '@/services/id-cards';
import { downloadBlob } from '@/utils/download-blob';

export type Cr80PrintOptions = {
  model: IdCardModel;
  layout: IdCardLayoutV1;
  holderType?: string;
  calibration?: PrintCalibration;
  evolisFeed?: EvolisFeedOptions;
  /** Preview always renders upright (1:1 with designer). Evolis feed rotation only when purpose is evolis. */
  purpose?: Cr80PrintPurpose;
  testMode?: boolean;
  signatureUrl?: string | null;
};

/** Generate CR80 PDF via server (exact mm) then open print preview window. */
export async function openCr80PrintPreview(options: Cr80PrintOptions) {
  const purpose = options.purpose ?? 'preview';
  const { frontHtml, backHtml, meta } = buildCr80PrintDocument({
    model: options.model,
    layout: options.layout,
    holderType: options.holderType,
    calibration: options.calibration,
    evolisFeed: options.evolisFeed,
    purpose,
    testMode: options.testMode,
    signatureUrl: options.signatureUrl,
  });
  const html = buildCr80PrintHtmlDocument(frontHtml, backHtml);
  const blob = await renderIdCardPdf(html);
  const url = URL.createObjectURL(blob);

  const win = window.open('', '_blank', 'width=960,height=760');
  if (!win) {
    downloadBlob(blob, 'id-card-cr80.pdf');
    return;
  }

  const debugRows = [
    ['Canvas width', `${meta.widthMm} mm`],
    ['Canvas height', `${meta.heightMm} mm`],
    ['Orientation', meta.orientation],
    ['Front rotation', `${meta.frontRotationDeg}°`],
    ['Back rotation', `${meta.backRotationDeg}°`],
    ['Purpose', meta.purpose],
    ['Evolis feed applied', meta.evolisFeedApplied ? 'Yes' : 'No'],
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');

  win.document.write(`<!DOCTYPE html><html><head><title>CR80 Print Preview</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #1e293b; color: #fff; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; background: #0f172a; align-items: center; }
  .toolbar button { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }
  .primary { background: #7c3aed; color: #fff; }
  .secondary { background: #334155; color: #fff; }
  .layout { display: flex; height: calc(100vh - 56px); }
  .debug { width: 240px; flex-shrink: 0; background: #0f172a; padding: 12px; font-size: 11px; overflow: auto; border-right: 1px solid #334155; }
  .debug h3 { margin: 0 0 8px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  .debug table { width: 100%; border-collapse: collapse; }
  .debug td { padding: 4px 0; vertical-align: top; }
  .debug td:first-child { color: #94a3b8; padding-right: 8px; }
  .debug td:last-child { font-weight: 600; color: #e2e8f0; }
  .debug .note { margin-top: 12px; color: #64748b; line-height: 1.4; }
  iframe { flex: 1; border: 0; background: #64748b; }
  .hint { font-size: 12px; color: #94a3b8; margin-left: auto; }
</style></head><body>
  <div class="toolbar">
    <button class="primary" onclick="document.getElementById('pdf').contentWindow.print()">Print PDF (Actual Size)</button>
    <button class="secondary" onclick="window.close()">Close</button>
    <span class="hint">CR80 ${meta.widthMm} × ${meta.heightMm} mm · Portrait · Do NOT use Fit-to-Width</span>
  </div>
  <div class="layout">
    <aside class="debug">
      <h3>Print debug</h3>
      <table>${debugRows}</table>
      <p class="note">Preview matches the designer canvas 1:1. Evolis feed rotation is never applied here. Use offset calibration (mm) only — offsets translate content, never rotate.</p>
    </aside>
    <iframe id="pdf" src="${url}"></iframe>
  </div>
</body></html>`);
  win.document.close();
}

/** @deprecated Use openCr80PrintPreview — browser HTML print distorts layout. */
export function printCr80IdCard(_options: {
  frontHtml: string;
  backHtml: string;
  evolisRotateFront?: boolean;
}) {
  console.warn('printCr80IdCard(html) is deprecated. Use openCr80PrintPreview with model+layout.');
}
