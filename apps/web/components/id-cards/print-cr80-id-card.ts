import type { IdCardModel } from '@/types/id-card';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import {
  buildCr80PrintDocument,
  buildCr80PrintHtmlDocument,
  type Cr80PrintPurpose,
} from './build-cr80-print-html';
import type { EvolisFeedOptions, PrintCalibration } from './cr80-designer-constants';
import { assertPdfBlob } from './id-card-pdf-blob';
import { renderIdCardPdf } from '@/services/id-cards';
import { downloadBlob } from '@/utils/download-blob';
import { apiErrorMessage } from '@/utils/api-error';

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

/**
 * Open CR80 print preview.
 * HTML cards are inlined (no blob iframe) so Firefox/Chrome always show front+back.
 * PDF is generated in the background for Print / Download.
 */
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
  const printHtml = buildCr80PrintHtmlDocument(frontHtml, backHtml);

  const win = window.open('', '_blank', 'width=1100,height=820');
  if (!win) {
    try {
      const blob = await assertPdfBlob(await renderIdCardPdf(printHtml));
      downloadBlob(blob, 'id-card-cr80.pdf');
    } catch (e) {
      alert(apiErrorMessage(e, 'Could not generate ID card PDF'));
    }
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

  // Inline cards — do NOT use blob: iframe (Firefox often leaves it blank).
  win.document.open();
  win.document
    .write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CR80 Print Preview</title>
<style>
  html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; background: #1e293b; color: #fff; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; background: #0f172a; align-items: center; }
  .toolbar button { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }
  .toolbar button:disabled { opacity: 0.5; cursor: wait; }
  .primary { background: #7c3aed; color: #fff; }
  .secondary { background: #334155; color: #fff; }
  .layout { display: flex; height: calc(100vh - 56px); min-height: 0; }
  .debug { width: 240px; flex-shrink: 0; background: #0f172a; padding: 12px; font-size: 11px; overflow: auto; border-right: 1px solid #334155; }
  .debug h3 { margin: 0 0 8px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  .debug table { width: 100%; border-collapse: collapse; }
  .debug td { padding: 4px 0; vertical-align: top; }
  .debug td:first-child { color: #94a3b8; padding-right: 8px; }
  .debug td:last-child { font-weight: 600; color: #e2e8f0; }
  .debug .note { margin-top: 12px; color: #64748b; line-height: 1.4; }
  .debug .status { margin-top: 12px; padding: 8px; border-radius: 6px; background: #334155; color: #e2e8f0; line-height: 1.4; white-space: pre-wrap; }
  .debug .status.error { background: #7f1d1d; color: #fecaca; }
  .debug .status.ok { background: #14532d; color: #bbf7d0; }
  .viewer {
    flex: 1; min-width: 0; min-height: 0; overflow: auto;
    background: #64748b;
    display: flex; flex-wrap: wrap; gap: 16px; align-content: flex-start;
    justify-content: center; padding: 24px; box-sizing: border-box;
  }
  .viewer .cr80-page {
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    background: #fff;
    flex-shrink: 0;
    /* px fallback so cards never collapse if mm is ignored */
    min-width: 204px;
    min-height: 323px;
  }
  .viewer-pdf { display: none; width: 100%; height: 100%; border: 0; background: #64748b; }
  .viewer.mode-pdf { display: block; padding: 0; }
  .viewer.mode-pdf .cr80-page { display: none; }
  .viewer.mode-pdf .viewer-pdf { display: block; width: 100%; height: 100%; }
  .hint { font-size: 12px; color: #94a3b8; margin-left: auto; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
</style></head><body>
  <div class="toolbar">
    <button class="primary" id="btn-print" disabled>Preparing PDF…</button>
    <button class="secondary" id="btn-download" disabled>Download PDF</button>
    <button class="secondary" id="btn-toggle" type="button" disabled>Show PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
    <span class="hint">CR80 ${meta.widthMm} × ${meta.heightMm} mm · Portrait · Do NOT use Fit-to-Width</span>
  </div>
  <div class="layout">
    <aside class="debug">
      <h3>Print debug</h3>
      <table>${debugRows}</table>
      <p class="note">Front &amp; back cards below are live HTML (same layout as PVC). Use Download PDF for the exact print file.</p>
      <div class="status" id="status">Generating PDF in background…</div>
    </aside>
    <div class="viewer" id="viewer">
      ${frontHtml}
      ${backHtml}
      <iframe class="viewer-pdf" id="pdf-frame" title="PDF preview"></iframe>
    </div>
  </div>
</body></html>`);
  win.document.close();

  const statusEl = () => win.document.getElementById('status');
  const printBtn = () => win.document.getElementById('btn-print') as HTMLButtonElement | null;
  const downloadBtn = () => win.document.getElementById('btn-download') as HTMLButtonElement | null;
  const toggleBtn = () => win.document.getElementById('btn-toggle') as HTMLButtonElement | null;
  const viewerEl = () => win.document.getElementById('viewer');
  const pdfFrame = () => win.document.getElementById('pdf-frame') as HTMLIFrameElement | null;

  try {
    const pdfBlob = await assertPdfBlob(await renderIdCardPdf(printHtml));
    const url = URL.createObjectURL(pdfBlob);

    const status = statusEl();
    if (status) {
      status.className = 'status ok';
      status.textContent =
        'PDF ready. Cards above = HTML preview. Use Download PDF, or Show PDF to inspect the file.';
    }

    const pBtn = printBtn();
    if (pBtn) {
      pBtn.disabled = false;
      pBtn.textContent = 'Print PDF (Actual Size)';
      pBtn.onclick = () => {
        const pdfWin = window.open(url, '_blank', 'width=720,height=900');
        if (!pdfWin) {
          downloadBlob(pdfBlob, 'id-card-cr80.pdf');
          return;
        }
        setTimeout(() => {
          try {
            pdfWin.print();
          } catch {
            /* viewer may block until loaded */
          }
        }, 800);
      };
    }

    const dBtn = downloadBtn();
    if (dBtn) {
      dBtn.disabled = false;
      dBtn.onclick = () => downloadBlob(pdfBlob, 'id-card-cr80.pdf');
    }

    const tBtn = toggleBtn();
    const frame = pdfFrame();
    if (frame) frame.src = url;
    if (tBtn) {
      tBtn.disabled = false;
      let showingPdf = false;
      tBtn.onclick = () => {
        showingPdf = !showingPdf;
        const viewer = viewerEl();
        if (viewer) {
          viewer.classList.toggle('mode-pdf', showingPdf);
        }
        tBtn.textContent = showingPdf ? 'Show HTML' : 'Show PDF';
      };
    }
  } catch (e) {
    const status = statusEl();
    if (status) {
      status.className = 'status error';
      status.textContent = `PDF render failed:\n${apiErrorMessage(e, 'Could not generate ID card PDF')}\n\nHTML cards above should still be visible. Restart the API if Puppeteer/Chrome cannot launch.`;
    }
    const btn = printBtn();
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'PDF unavailable';
    }
  }
}

/** @deprecated Use openCr80PrintPreview — browser HTML print distorts layout. */
export function printCr80IdCard(_options: {
  frontHtml: string;
  backHtml: string;
  evolisRotateFront?: boolean;
}) {
  console.warn('printCr80IdCard(html) is deprecated. Use openCr80PrintPreview with model+layout.');
}
