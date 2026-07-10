export function proposalStyles(primary: string, secondary: string) {
  return `
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --accent: #0EA5E9;
      --ink: #0f172a;
      --muted: #475569;
      --border: #dbe4f3;
      --soft: #f8fafc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: #fff;
    }
    .page {
      width: 210mm;
      height: 297mm;
      padding: 10mm 11mm 14mm;
      margin: 0 auto;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .page-content {
      margin-top: 4px;
      padding-bottom: 20mm;
      max-height: calc(297mm - 30mm);
      overflow: hidden;
    }
    .header, .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--muted);
      font-size: 11px;
    }
    .footer {
      position: absolute;
      bottom: 10mm;
      left: 12mm;
      right: 12mm;
      border-top: 1px solid var(--border);
      padding-top: 6px;
    }
    .footer-brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 10px;
      line-height: 1.4;
    }
    .footer-brand.compact {
      gap: 1px;
      font-size: 9px;
      line-height: 1.25;
    }
    .footer-brand.compact strong { font-size: 10px; }
    .footer-brand strong { color: var(--primary); font-size: 11px; }
    .footer-contacts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; color: var(--muted); }
    .footer-contact-item { display: inline-flex; align-items: center; gap: 4px; }
    .logo { height: 48px; object-fit: contain; }
    .logo-sm { height: 36px; object-fit: contain; }
    h1, h2, h3 { margin: 0; }
    h1 { font-size: 28px; color: var(--primary); line-height: 1.2; }
    h2 { font-size: 18px; color: var(--primary); margin: 0 0 6px; }
    h3 { font-size: 13px; margin: 0 0 4px; color: #0b2f66; }
    p, li { line-height: 1.4; margin: 0 0 5px; color: var(--ink); font-size: 12px; }
    ul { margin: 0 0 6px; padding-left: 16px; }
    .hero {
      margin-top: 16px;
      border-radius: 18px;
      background: linear-gradient(120deg, var(--primary), #164f99);
      color: #fff;
      padding: 28px;
      box-shadow: 0 12px 30px rgba(30, 58, 138, 0.18);
    }
    .hero p { color: rgba(255,255,255,0.95); }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .chip {
      background: rgba(255,255,255,0.2);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
    }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
    }
    .card-compact {
      padding: 8px;
    }
    .card-compact p { margin-bottom: 0; font-size: 11px; }
    .card-compact strong { font-size: 12px; }
    .card-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      margin-bottom: 5px;
    }
    .kpi { font-size: 22px; color: var(--primary); font-weight: 700; }
    .kpi-sm { font-size: 15px; }
    .small { color: var(--muted); font-size: 11px; }
    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 4px 0 6px;
    }
    .chip-box {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #f8fafc;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #0b2f66;
    }
    .module-tile {
      text-align: center;
      padding: 8px 6px;
    }
    .module-tile .card-icon {
      margin: 0 auto 4px;
    }
    .module-tile strong {
      font-size: 11px;
      display: block;
    }
    .toc { columns: 1; max-width: 140mm; }
    .toc-compact li { margin-bottom: 8px; color: var(--muted); font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid var(--border); padding: 8px; text-align: left; }
    th { background: #edf4ff; color: #0b2f66; }
    .timeline-item {
      border-left: 3px solid var(--primary);
      padding: 4px 0 4px 10px;
      margin-left: 2px;
      margin-bottom: 4px;
    }
    .flow {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin: 8px 0;
    }
    .flow-compact {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin: 6px 0 8px;
    }
    .flow-box {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px 10px;
      background: var(--soft);
      font-size: 11px;
      min-width: 0;
      text-align: center;
    }
    .flow-arrow { color: var(--primary); font-size: 14px; font-weight: 700; }
    .flow-highlight {
      background: linear-gradient(120deg, var(--primary), #164f99);
      color: #fff;
      border: none;
      font-weight: 600;
    }
    .screenshot {
      border: 2px dashed #94a3b8;
      border-radius: 12px;
      background: #f8fafc;
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: 12px;
      margin-top: 8px;
    }
    .dashboard-mockup {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .dash-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: linear-gradient(90deg, var(--primary), var(--secondary), var(--accent));
      color: #fff;
      font-size: 10px;
      font-weight: 600;
    }
    .dash-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 10px;
      background: #f8fafc;
    }
    .dash-widget {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px;
      font-size: 9px;
    }
    .dash-widget strong { display: block; font-size: 13px; color: var(--primary); margin-top: 4px; }
    .dash-bar {
      height: 4px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      margin-bottom: 4px;
    }
    .dash-charts {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 8px;
      padding: 0 10px 10px;
      background: #f8fafc;
    }
    .dash-chart {
      height: 56px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background:
        linear-gradient(180deg, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.02) 100%),
        repeating-linear-gradient(90deg, #dbeafe 0, #dbeafe 1px, transparent 1px, transparent 12px);
    }
    .phone-frame {
      width: 130px;
      margin: 0 auto;
      border-radius: 22px;
      border: 3px solid #1e293b;
      background: #0f172a;
      padding: 8px 6px 10px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2);
    }
    .phone-notch {
      width: 42px;
      height: 5px;
      border-radius: 999px;
      background: #334155;
      margin: 0 auto 6px;
    }
    .phone-screen {
      border-radius: 14px;
      background: #fff;
      overflow: hidden;
      min-height: 170px;
    }
    .phone-header {
      background: linear-gradient(120deg, var(--primary), var(--secondary));
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      text-align: center;
      padding: 8px 6px;
    }
    .phone-menu { padding: 8px 6px; display: grid; gap: 5px; }
    .phone-item {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px;
      font-size: 8px;
      background: #f8fafc;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .page--cover {
      padding: 0;
      margin: 0 auto;
      overflow: hidden;
    }
    .cover-page {
      width: 100%;
      height: 100%;
    }
    .cover-v2 {
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: #fff;
      color: #0f172a;
    }
    .cover-v2-body {
      position: relative;
      z-index: 2;
      padding: 10mm 12mm 0;
      height: calc(297mm - 14mm);
    }
    .cover-v2-dots {
      position: absolute;
      z-index: 0;
      width: 120px;
      height: 120px;
      opacity: 0.55;
      background-image: radial-gradient(#cbd5e1 1.2px, transparent 1.2px);
      background-size: 10px 10px;
    }
    .cover-v2-dots--tl { top: 8mm; left: 8mm; }
    .cover-v2-dots--mr { top: 34mm; right: 16mm; width: 90px; height: 90px; }
    .cover-v2-waves {
      position: absolute;
      left: 0;
      top: 36mm;
      width: 34mm;
      height: 70mm;
      z-index: 0;
      opacity: 0.35;
      background:
        repeating-radial-gradient(circle at 0 50%, transparent 0 18px, rgba(148,163,184,0.35) 18px 19px);
    }
    .cover-v2-watermark {
      position: absolute;
      right: 0;
      top: 48mm;
      width: 88mm;
      opacity: 0.07;
      z-index: 0;
      pointer-events: none;
    }
    .cover-v2-watermark svg { width: 100%; height: auto; }
    .cover-v2-swoosh {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 58mm;
      z-index: 1;
      pointer-events: none;
    }
    .cover-v2-swoosh svg { width: 100%; height: 100%; display: block; }
    .cover-v2-header {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8mm;
      align-items: start;
      margin-bottom: 8mm;
    }
    .cover-v2-header-left {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-width: 0;
    }
    .cover-v2-inst-logo {
      width: 62px;
      height: 62px;
      border-radius: 999px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .cover-v2-inst-logo--placeholder {
      background: #e2e8f0;
    }
    .cover-v2-inst-name {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.03em;
      color: #0b2f66;
      line-height: 1.25;
      margin-bottom: 6px;
    }
    .cover-v2-affiliation {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 9.5px;
      line-height: 1.35;
      color: #334155;
      margin-bottom: 3px;
    }
    .cover-v2-affiliation-icon {
      flex: 0 0 auto;
      margin-top: 1px;
    }
    .cover-v2-header-rule {
      width: 1px;
      height: 72px;
      background: #cbd5e1;
      margin-top: 4px;
    }
    .cover-v2-header-right {
      text-align: right;
      min-width: 46mm;
    }
    .cover-v2-bcl-logo {
      width: 54px;
      height: 54px;
      object-fit: contain;
      display: inline-block;
      margin-bottom: 4px;
      background: transparent;
      border: 0;
      border-radius: 999px;
    }
    .cover-v2-company-name {
      font-size: 12px;
      font-weight: 700;
      color: #0b2f66;
    }
    .cover-v2-company-tagline {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
    }
    .cover-v2-hero {
      text-align: center;
      padding: 0 8mm;
      margin-top: 2mm;
    }
    .cover-v2-eyebrow {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #2563eb;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .cover-v2-eyebrow span {
      width: 52px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #93c5fd, transparent);
    }
    .cover-v2-eyebrow em {
      font-style: normal;
    }
    .cover-v2-title {
      margin: 0;
      font-size: 34px;
      line-height: 1.15;
      font-weight: 800;
      color: #0b2f66;
    }
    .cover-v2-title-accent {
      color: #2563eb;
    }
    .cover-v2-subtitle {
      margin: 8px 0 0;
      font-size: 18px;
      line-height: 1.3;
      font-weight: 700;
      color: #0f172a;
    }
    .cover-v2-hero-rule {
      width: 78%;
      height: 1px;
      background: #cbd5e1;
      margin: 10px auto 8px;
    }
    .cover-v2-building-art {
      width: 88px;
      height: auto;
      display: block;
      margin: 0 auto 8px;
    }
    .cover-v2-proposal-line {
      margin: 0 0 10px;
      font-size: 15px;
      line-height: 1.45;
      font-weight: 700;
      color: #0b2f66;
    }
    .cover-v2-year-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      background: rgba(255,255,255,0.92);
      padding: 8px 16px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
      margin-bottom: 10mm;
    }
    .cover-v2-year-icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cover-v2-year-text {
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .cover-v2-year-text span {
      font-size: 9px;
      letter-spacing: 0.08em;
      color: #64748b;
      font-weight: 700;
    }
    .cover-v2-year-text strong {
      font-size: 16px;
      color: #0b2f66;
      letter-spacing: 0.02em;
    }
    .cover-v2-info-card {
      position: relative;
      z-index: 3;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      background: rgba(255,255,255,0.94);
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      margin: 0 2mm;
    }
    .cover-v2-info-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: stretch;
    }
    .cover-v2-info-split {
      width: 1px;
      background: #dbe4f3;
    }
    .cover-v2-info-hrule {
      height: 1px;
      background: #dbe4f3;
    }
    .cover-v2-info-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      min-height: 68px;
    }
    .cover-v2-info-icon {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    .cover-v2-info-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .cover-v2-info-copy span {
      font-size: 9px;
      letter-spacing: 0.08em;
      color: #64748b;
      font-weight: 700;
    }
    .cover-v2-info-copy strong {
      font-size: 12px;
      color: #0b2f66;
      line-height: 1.25;
    }
    .cover-v2-info-copy em {
      font-style: normal;
      font-size: 9.5px;
      color: #475569;
      line-height: 1.25;
    }
    .cover-v2-footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 4;
      height: 14mm;
      background: #0b2f66;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      font-size: 10px;
      font-weight: 500;
    }
    .cover-v2-footer span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .arch-diagram {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin: 6px 0 8px;
    }
    .arch-compact { margin: 4px 0 6px; }
    .arch-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .arch-box {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 14px;
      background: var(--soft);
      font-size: 12px;
      text-align: center;
    }
    .arch-core {
      background: linear-gradient(120deg, var(--primary), #164f99);
      color: #fff;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 12px;
    }
    .compare-yes { background: #ecfdf5; }
    .compare-no { background: #fef2f2; }
    .signature-box {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .line {
      border-top: 1px solid #94a3b8;
      margin-top: 28px;
      padding-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    .cover-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(160deg, #f8fbff 0%, #e8f1ff 45%, #fff 100%);
      z-index: 0;
    }
    .cover-content { position: relative; z-index: 1; }
    .cover-mockups {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 12px;
      margin-top: 20px;
    }
    .thank-you {
      text-align: center;
      margin-top: 12px;
    }
    .thank-you-compact { margin-top: 4px; }
    .thank-you h1 { font-size: 28px; }
    .qr-box {
      width: 90px;
      height: 90px;
      border: 2px solid var(--border);
      border-radius: 8px;
      margin: 16px auto 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: var(--muted);
    }
    .qr-wrap {
      margin-top: 14px;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: #fff;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
    }
    .qr-image {
      width: 96px;
      height: 96px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #fff;
      object-fit: contain;
    }
    .no-break { page-break-inside: avoid; }
    .badge {
      display: inline-block;
      background: #edf4ff;
      color: var(--primary);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
    }
  `;
}
