import JsBarcode from 'jsbarcode';
import type { LibraryBarcodeLabelPayload, LibraryBarcodeLabelSettings } from '@/services/library';

export type { LibraryBarcodeLabelPayload, LibraryBarcodeLabelSettings };

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function zebraBarcodeLabelSettings(headerCode = 'DBCL'): LibraryBarcodeLabelSettings {
  return {
    preset: 'ZEBRA_2UP',
    pageWidthMm: 101.6,
    pageHeightMm: 24.89,
    columns: 2,
    rows: 1,
    marginTopMm: 0,
    marginRightMm: 0,
    marginBottomMm: 0,
    marginLeftMm: 0,
    gapXMm: 1.6,
    gapYMm: 0,
    labelWidthMm: 50,
    labelHeightMm: 24.89,
    barcodeHeightMm: 14,
    moduleWidth: 1.15,
    fontSizePt: 8,
    showLogo: false,
    showTitle: false,
    showAuthor: false,
    showDepartment: false,
    showCallNumber: true,
    showAccession: true,
    headerTitle: '',
    headerSubtitle: '',
    headerCode,
  };
}

function a4BarcodeLabelSettings(): LibraryBarcodeLabelSettings {
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const columns = 2;
  const rows = 4;
  const margin = 10;
  const gapXMm = 4;
  const gapYMm = 4;
  const labelWidthMm = (pageWidthMm - margin * 2 - gapXMm * (columns - 1)) / columns;
  const labelHeightMm = (pageHeightMm - margin * 2 - gapYMm * (rows - 1)) / rows;
  return {
    preset: 'A4_2X4',
    pageWidthMm,
    pageHeightMm,
    columns,
    rows,
    marginTopMm: margin,
    marginRightMm: margin,
    marginBottomMm: margin,
    marginLeftMm: margin,
    gapXMm,
    gapYMm,
    labelWidthMm: Math.round(labelWidthMm * 100) / 100,
    labelHeightMm: Math.round(labelHeightMm * 100) / 100,
    barcodeHeightMm: 14,
    moduleWidth: 1.4,
    fontSizePt: 8,
    showLogo: true,
    showTitle: true,
    showAuthor: true,
    showDepartment: true,
    showCallNumber: true,
    showAccession: true,
    headerTitle: '',
    headerSubtitle: '',
    headerCode: 'DBCL',
  };
}

export function defaultBarcodeLabelSettings(): LibraryBarcodeLabelSettings {
  return zebraBarcodeLabelSettings();
}

export function applyBarcodePreset(
  template: LibraryBarcodeLabelSettings,
  preset: LibraryBarcodeLabelSettings['preset'],
): LibraryBarcodeLabelSettings {
  if (preset === 'ZEBRA_2UP') {
    const stock = zebraBarcodeLabelSettings(template.headerCode || 'DBCL');
    return {
      ...stock,
      showCallNumber: template.showCallNumber,
      showAccession: template.showAccession,
    };
  }
  if (preset === 'A4_2X4') {
    const fitted = a4BarcodeLabelSettings();
    return {
      ...fitted,
      showLogo: template.showLogo,
      showTitle: template.showTitle,
      showAuthor: template.showAuthor,
      showDepartment: template.showDepartment,
      showCallNumber: template.showCallNumber,
      showAccession: template.showAccession,
      headerTitle: template.headerTitle,
      headerSubtitle: template.headerSubtitle,
      headerCode: template.headerCode,
    };
  }
  if (preset === 'SINGLE') {
    return {
      ...template,
      preset,
      columns: 1,
      rows: 1,
      labelWidthMm: 90,
      labelHeightMm: 50,
      marginTopMm: 5,
      marginRightMm: 5,
      marginBottomMm: 5,
      marginLeftMm: 5,
      gapXMm: 0,
      gapYMm: 0,
      pageWidthMm: 100,
      pageHeightMm: 60,
    };
  }
  if (preset === 'ROLL') {
    return {
      ...template,
      preset,
      columns: 1,
      rows: 1,
      labelWidthMm: 50,
      labelHeightMm: 30,
      marginTopMm: 2,
      marginRightMm: 2,
      marginBottomMm: 2,
      marginLeftMm: 2,
      gapXMm: 0,
      gapYMm: 0,
      pageWidthMm: 54,
      pageHeightMm: 34,
    };
  }
  return { ...template, preset: 'CUSTOM' };
}

export function preferPrinterStock(
  template: LibraryBarcodeLabelSettings,
): LibraryBarcodeLabelSettings {
  const legacySheet =
    template.preset === 'A4_2X4' &&
    template.pageWidthMm === 210 &&
    template.pageHeightMm === 297 &&
    template.columns === 2 &&
    template.rows === 4 &&
    template.marginTopMm === 10 &&
    template.showLogo &&
    template.showTitle &&
    template.headerSubtitle.trim().toUpperCase() === 'LIBRARY';
  if (!legacySheet) return template;
  return applyBarcodePreset(template, 'ZEBRA_2UP');
}

export function isCompactBarcodeLabel(settings: LibraryBarcodeLabelSettings) {
  return (
    settings.preset === 'ZEBRA_2UP' ||
    (settings.labelWidthMm <= 60 &&
      settings.labelHeightMm <= 32 &&
      !settings.showLogo &&
      !settings.showTitle)
  );
}

export function barcodeLabelDocument(
  labels: LibraryBarcodeLabelPayload[],
  settings: LibraryBarcodeLabelSettings,
  options?: { autoPrint?: boolean; jobId?: string },
) {
  const zebra = isZebraPair(settings);
  const copies = zebra ? labels.flatMap((label) => [label, label]) : labels;
  const perPage = zebra ? 2 : Math.max(settings.columns * settings.rows, 1);
  const pages: Array<Array<LibraryBarcodeLabelPayload | null>> = [];
  for (let index = 0; index < copies.length; index += perPage) {
    const page = copies.slice(index, index + perPage);
    pages.push(zebra ? [page[0] ?? null, page[1] ?? null] : page);
  }
  const logo =
    typeof window === 'undefined' ? '' : `${window.location.origin}/branding/college-logo.png`;
  const sheets = pages
    .map((page, index) => {
      const slots = page
        .map((label, slot) =>
          label
            ? labelMarkup(label, settings, logo, zebra ? (slot === 0 ? 'slot-a' : 'slot-b') : '')
            : `<article class="label compact ${slot === 0 ? 'slot-a' : 'slot-b'}"></article>`,
        )
        .join('');
      const last = index === pages.length - 1 ? ' last' : '';
      return `<section class="sheet${zebra ? ' zebra' : ''}${last}">${slots}</section>`;
    })
    .join('');
  const jobScript = options?.jobId
    ? `<script>
        window.addEventListener('afterprint', function () {
          if (window.opener) {
            window.opener.postMessage({ source: 'library-barcode', jobId: ${JSON.stringify(options.jobId)}, status: 'USER_CONFIRMED' }, ${JSON.stringify(typeof window === 'undefined' ? '' : window.location.origin)});
          }
        });
        ${options.autoPrint === false ? '' : 'window.addEventListener("load", function () { window.print(); });'}
      </script>`
    : options?.autoPrint === false
      ? ''
      : '<script>window.addEventListener("load", function () { window.print(); });</script>';
  const pageWidth = zebra ? '4in' : `${settings.pageWidthMm}mm`;
  const pageHeight = zebra ? '0.98in' : `${settings.pageHeightMm}mm`;
  // A CSS size wider than it is tall makes Chrome send a landscape print ticket.
  // The GT800 driver stock is portrait 4.00 × 0.98 inch, so that ticket is rotated
  // 90 degrees until Printing Preferences is opened and confirmed. size:auto keeps
  // the driver's saved portrait stock.
  const pageRule = zebra
    ? '@page { size: auto; margin: 0; }'
    : `@page { size: ${pageWidth} ${pageHeight}; margin: 0; }`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Library barcode labels</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; ${zebra ? 'width: 4in;' : ''} }
    .sheet {
      width: ${pageWidth};
      height: ${pageHeight};
      padding: ${settings.marginTopMm}mm ${settings.marginRightMm}mm ${settings.marginBottomMm}mm ${settings.marginLeftMm}mm;
      display: grid;
      grid-template-columns: repeat(${settings.columns}, ${settings.labelWidthMm}mm);
      grid-template-rows: repeat(${settings.rows}, ${settings.labelHeightMm}mm);
      column-gap: ${settings.gapXMm}mm;
      row-gap: ${settings.gapYMm}mm;
      page-break-after: always;
      overflow: hidden;
    }
    .label {
      width: ${settings.labelWidthMm}mm;
      height: ${settings.labelHeightMm}mm;
      border: 0.2mm solid #9ca3af;
      padding: 1.6mm 2mm;
      display: flex;
      flex-direction: column;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${settings.fontSizePt}pt;
      line-height: 1.15;
    }
    header { display: flex; align-items: center; gap: 1.4mm; border-bottom: 0.2mm solid #d1d5db; padding-bottom: 1mm; }
    header img { width: 7mm; height: 7mm; object-fit: contain; }
    .head-copy { flex: 1; min-width: 0; }
    .head-copy strong, .head-copy span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .head-copy strong { font-size: ${Math.max(settings.fontSizePt - 1, 6)}pt; letter-spacing: 0.01em; }
    .head-copy span { font-size: ${Math.max(settings.fontSizePt - 2, 6)}pt; letter-spacing: 0.08em; }
    .mark { font-size: ${settings.fontSizePt + 1}pt; font-weight: 800; }
    .body { display: flex; gap: 2mm; min-height: 0; flex: 1; padding-top: 1.2mm; }
    .meta { flex: 1; min-width: 0; }
    .title { font-weight: 700; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .author, .line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bars { width: 42%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 0.2mm solid #e5e7eb; padding-left: 1.4mm; }
    .bars svg { width: 100%; height: ${settings.barcodeHeightMm}mm; }
    .acc { margin-top: 0.6mm; font-weight: 800; font-size: ${settings.fontSizePt + 2}pt; letter-spacing: 0.03em; }
    .label.compact {
      border: none;
      padding: 1mm 1.5mm 0.9mm;
      justify-content: flex-start;
    }
    .label.compact .bars {
      width: 100%;
      height: ${Math.min(settings.barcodeHeightMm, 15)}mm;
      flex: none;
      border: none;
      padding: 0.4mm 0.6mm 0;
      align-items: stretch;
    }
    .label.compact .bars svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .label.compact .foot {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1.4mm;
      margin-top: auto;
      padding-top: 0.45mm;
      line-height: 1;
    }
    .label.compact .acc {
      margin: 0;
      min-width: 0;
      font-weight: 700;
      font-size: 13.5pt;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .label.compact .acc.long { font-size: 8pt; letter-spacing: 0; }
    .label.compact .markbox { margin-left: auto; max-width: 62%; min-width: 0; text-align: right; }
    .label.compact .code { font-size: 8pt; font-weight: 800; letter-spacing: 0.08em; }
    .label.compact .call {
      margin-top: 0.4mm;
      font-size: 7pt;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media screen { .label.compact { box-shadow: inset 0 0 0 0.15mm #e5e7eb; } }
    .sheet.zebra {
      display: block;
      position: relative;
      width: 4in;
      /* Stay a hair under the 0.98in stock. A full-height row feeds one extra blank label. */
      height: 0.97in;
      margin: 0;
      padding: 0;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      break-after: page;
      page-break-after: always;
    }
    .sheet.zebra + .sheet.zebra {
      break-before: page;
      page-break-before: always;
    }
    .sheet.zebra.last {
      break-after: avoid;
      page-break-after: avoid;
    }
    .sheet.zebra .label {
      position: absolute;
      top: 0;
      width: 1.968in;
      height: 0.97in;
      margin: 0;
      border: 0;
      padding: 0.05in 0.08in;
      justify-content: center;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
    }
    .sheet.zebra .slot-a { left: 0; }
    .sheet.zebra .slot-b { left: 2.032in; }
    .sheet.zebra .label.compact .bars {
      width: 1.8in;
      height: 0.34in;
      margin: 0 auto;
      padding: 0 0.04in;
      border-bottom: 0;
    }
    .sheet.zebra .label.compact .bars svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .sheet.zebra .label.compact .foot {
      height: auto;
      margin-top: 0.02in;
      align-items: flex-end;
    }
    .sheet.zebra .label.compact .acc {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1;
    }
    .sheet.zebra .label.compact .acc.long {
      font-size: 8pt;
      letter-spacing: 0;
    }
    .sheet.zebra .label.compact .code {
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.08em;
    }
    .sheet.zebra .label.compact .call {
      margin-top: 0.01in;
      font-size: 7pt;
      font-weight: 700;
    }
    .sheet.last { page-break-after: auto; break-after: auto; }
    @media print {
      .sheet { page-break-after: always; break-after: page; }
      .sheet.last { page-break-after: auto; break-after: auto; }
      .sheet.zebra {
        height: 0.97in;
        overflow: hidden;
        break-inside: avoid;
        page-break-inside: avoid;
        break-after: page;
        page-break-after: always;
      }
      .sheet.zebra + .sheet.zebra {
        break-before: page;
        page-break-before: always;
      }
      .sheet.zebra.last {
        break-after: avoid;
        page-break-after: avoid;
      }
      .label.compact { box-shadow: none; }
      .sheet.zebra .label { overflow: hidden; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${sheets || '<p>No labels to print.</p>'}
  ${jobScript}
</body>
</html>`;
}

function isZebraPair(settings: LibraryBarcodeLabelSettings) {
  if (settings.preset === 'ZEBRA_2UP') return true;
  return (
    Math.abs(settings.pageWidthMm - 101.6) < 0.2 &&
    Math.abs(settings.pageHeightMm - 24.89) < 0.2 &&
    settings.columns === 2 &&
    settings.rows === 1 &&
    !settings.showLogo &&
    !settings.showTitle
  );
}

function labelMarkup(
  label: LibraryBarcodeLabelPayload,
  settings: LibraryBarcodeLabelSettings,
  logo: string,
  slot = '',
) {
  if (isCompactBarcodeLabel(settings)) return compactLabelMarkup(label, settings, slot);
  const header = `<header>
    ${settings.showLogo && logo ? `<img src="${esc(logo)}" alt="" />` : ''}
    <div class="head-copy">
      <strong>${esc(settings.headerTitle)}</strong>
      <span>${esc(settings.headerSubtitle)}</span>
    </div>
    ${settings.headerCode ? `<div class="mark">${esc(settings.headerCode)}</div>` : ''}
  </header>`;
  const meta = `<div class="meta">
    ${settings.showTitle ? `<div class="title">${esc(label.title)}</div>` : ''}
    ${settings.showAuthor ? `<div class="author">${esc(label.author)}</div>` : ''}
    ${settings.showCallNumber ? `<div class="line">Call No. ${esc(label.callNumber || '—')}</div>` : ''}
    ${settings.showDepartment ? `<div class="line">Dept. ${esc(label.department || '—')}</div>` : ''}
  </div>`;
  return `<article class="label">${header}<div class="body">${meta}<div class="bars">${barcodeSvg(label.encodedValue, settings)}<div class="acc">${settings.showAccession ? esc(label.accessionNumber) : ''}</div></div></div></article>`;
}

function compactLabelMarkup(
  label: LibraryBarcodeLabelPayload,
  settings: LibraryBarcodeLabelSettings,
  slot = '',
) {
  const call = label.callNumber.trim();
  const code = settings.headerCode.trim();
  const accession = label.accessionNumber.trim();
  const accClass = accession.length > 10 ? 'acc long' : 'acc';
  const mark = `${code ? `<div class="code">${esc(code)}</div>` : ''}${
    settings.showCallNumber && call ? `<div class="call">${esc(call)}</div>` : ''
  }`;
  return `<article class="label compact${slot ? ` ${slot}` : ''}"><div class="bars">${barcodeSvg(label.encodedValue, settings)}</div><div class="foot">${
    settings.showAccession ? `<div class="${accClass}">${esc(accession)}</div>` : '<div></div>'
  }${mark ? `<div class="markbox">${mark}</div>` : ''}</div></article>`;
}

function barcodeSvg(value: string, settings: LibraryBarcodeLabelSettings) {
  const code = value.trim();
  if (!code || typeof document === 'undefined') return `<div>${esc(code)}</div>`;
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, code, {
      format: 'CODE128',
      width: settings.moduleWidth,
      height: Math.round(settings.barcodeHeightMm * 3.78),
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('shape-rendering', 'crispEdges');
    return svg.outerHTML;
  } catch {
    return `<div>${esc(code)}</div>`;
  }
}

export function writeBarcodeSheet(
  target: Window,
  labels: LibraryBarcodeLabelPayload[],
  settings: LibraryBarcodeLabelSettings,
  options?: { autoPrint?: boolean; jobId?: string },
) {
  target.document.open();
  target.document.write(barcodeLabelDocument(labels, settings, options));
  target.document.close();
  if (options?.jobId && options.autoPrint !== false) {
    window.postMessage(
      { source: 'library-barcode', jobId: options.jobId, status: 'DIALOG_OPENED' },
      window.location.origin,
    );
  }
}
