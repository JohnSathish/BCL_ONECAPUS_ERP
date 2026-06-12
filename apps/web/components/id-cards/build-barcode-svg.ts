import JsBarcode from 'jsbarcode';

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Real CODE128 SVG for print/PDF (built client-side before render-pdf). */
export function renderBarcodePrintHtml(value: string): string {
  const val = value?.trim();
  if (!val) return '';

  if (typeof document === 'undefined') {
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif;">
      <p style="margin:0;font-size:3.2pt;font-weight:700;color:#64748b;">Barcode unavailable</p>
      <span style="margin-top:0.4mm;font-size:3.8pt;font-weight:800;color:#0f172a;">${escHtml(val)}</span>
    </div>`;
  }

  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, val, {
      format: 'CODE128',
      width: 1.45,
      height: 34,
      displayValue: false,
      margin: 0,
      background: 'transparent',
      lineColor: '#111827',
    });
    const viewBox = svg.getAttribute('viewBox') ?? '0 0 200 40';
    const inner = svg.innerHTML;
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:0 0.3mm;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" style="width:92%;height:58%;display:block;">${inner}</svg>
      <span style="margin-top:0.5mm;font-size:3.8pt;font-weight:800;color:#0f172a;font-family:Arial,sans-serif;letter-spacing:0.05em;">${escHtml(val)}</span>
    </div>`;
  } catch {
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif;">
      <span style="font-size:3.8pt;font-weight:800;color:#0f172a;">${escHtml(val)}</span>
    </div>`;
  }
}
