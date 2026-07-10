import type { ProposalTemplateContext } from './proposal-template.types';

const DEFAULT_AFFILIATIONS = [
  'Affiliated to the North Eastern University, Shillong – 793 002',
  'Recognised by University Grants Commission UGC, New Delhi',
  "(Re-accredited with 'B' Grade by NAAC Bangalore)",
];

function coverAffiliationIcon(index: number) {
  const icons = [
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>`,
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M12 3l8 4v5c0 5-3.5 9-8 9s-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M22 10l-10-6L2 10v2h20v-2z"/><path d="M6 12v5h4v-5M14 12v5h4v-5"/></svg>`,
  ];
  return icons[index] ?? icons[0];
}

function coverInfoIcon(type: 'person' | 'company' | 'version' | 'date') {
  const map = {
    person: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6"/></svg>`,
    company: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M8 8V5h8v3M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"/></svg>`,
    version: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8 14h8l-1 7H9l-1-7z"/></svg>`,
    date: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`,
  };
  return map[type];
}

function coverBuildingIllustration() {
  return `<svg class="cover-v2-building-art" viewBox="0 0 220 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M110 8 L170 34 V78 H50 V34 Z" stroke="#38bdf8" stroke-width="2.2" fill="none"/>
    <path d="M110 8 L50 34 H170 Z" stroke="#38bdf8" stroke-width="2.2" fill="none"/>
    <rect x="98" y="42" width="24" height="36" stroke="#38bdf8" stroke-width="2" fill="none"/>
    <path d="M86 52 H134" stroke="#38bdf8" stroke-width="1.8"/>
    <path d="M86 62 H134" stroke="#38bdf8" stroke-width="1.8"/>
    <path d="M86 72 H134" stroke="#38bdf8" stroke-width="1.8"/>
    <circle cx="110" cy="22" r="6" stroke="#38bdf8" stroke-width="1.8" fill="none"/>
  </svg>`;
}

function coverBuildingWatermark() {
  return `<svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M160 18 L290 78 V198 H30 V78 Z" stroke="#64748b" stroke-width="2.5"/>
    <path d="M160 18 L30 78 H290 Z" stroke="#64748b" stroke-width="2.5"/>
    <rect x="138" y="98" width="44" height="100" stroke="#64748b" stroke-width="2"/>
    <path d="M118 118 H202 M118 138 H202 M118 158 H202 M118 178 H202" stroke="#64748b" stroke-width="1.8"/>
    <rect x="56" y="108" width="34" height="90" stroke="#64748b" stroke-width="1.8"/>
    <rect x="230" y="108" width="34" height="90" stroke="#64748b" stroke-width="1.8"/>
    <circle cx="160" cy="48" r="10" stroke="#64748b" stroke-width="1.8"/>
  </svg>`;
}

function coverBackgroundLayers() {
  return `
    <div class="cover-v2-dots cover-v2-dots--tl"></div>
    <div class="cover-v2-dots cover-v2-dots--mr"></div>
    <div class="cover-v2-waves"></div>
    <div class="cover-v2-watermark">${coverBuildingWatermark()}</div>
    <div class="cover-v2-swoosh">
      <svg viewBox="0 0 794 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 120 C120 40 240 150 380 95 C520 40 620 130 794 75 L794 220 L0 220 Z" fill="#1e40af"/>
        <path d="M0 155 C150 95 280 175 430 125 C580 75 680 165 794 115 L794 220 L0 220 Z" fill="#2563eb" opacity="0.92"/>
        <path d="M0 185 C180 130 320 195 500 155 C640 125 720 185 794 160 L794 220 L0 220 Z" fill="#3b82f6" opacity="0.78"/>
      </svg>
    </div>`;
}

function formatCoverDate(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  return value;
}

function resolveAcademicYear(ctx: ProposalTemplateContext) {
  const fromCopy = ctx.copy?.coverAcademicYear?.trim();
  if (fromCopy) return fromCopy;
  const parsed = new Date(ctx.proposalDate);
  const year = Number.isNaN(parsed.getTime())
    ? new Date().getFullYear()
    : parsed.getFullYear();
  return `${year}–${year + 1}`;
}

function resolveAffiliations(ctx: ProposalTemplateContext) {
  const custom = ctx.copy?.coverAffiliations
    ?.split('|')
    .map((line) => line.trim())
    .filter(Boolean);
  return custom?.length ? custom : DEFAULT_AFFILIATIONS;
}

export function renderProposalCover(ctx: ProposalTemplateContext) {
  const institutionTitle = ctx.institutionName.toUpperCase();
  const affiliations = resolveAffiliations(ctx);
  const academicYear = resolveAcademicYear(ctx);
  const proposalDate = formatCoverDate(ctx.proposalDate);
  const institutionLogo = ctx.logoDataUri
    ? `<img class="cover-v2-inst-logo" src="${ctx.logoDataUri}" alt="${ctx.institutionName}" />`
    : `<div class="cover-v2-inst-logo cover-v2-inst-logo--placeholder"></div>`;
  const companyLogo = ctx.bclLogoDataUri
    ? `<img class="cover-v2-bcl-logo" src="${ctx.bclLogoDataUri}" alt="${ctx.companyName}" />`
    : '';

  const affiliationHtml = affiliations
    .map(
      (line, index) =>
        `<div class="cover-v2-affiliation"><span class="cover-v2-affiliation-icon">${coverAffiliationIcon(index)}</span><span>${line}</span></div>`,
    )
    .join('');

  return `<div class="cover-v2">
    ${coverBackgroundLayers()}
    <div class="cover-v2-body">
      <header class="cover-v2-header">
        <div class="cover-v2-header-left">
          ${institutionLogo}
          <div class="cover-v2-inst-text">
            <div class="cover-v2-inst-name">${institutionTitle}</div>
            ${affiliationHtml}
          </div>
        </div>
        <div class="cover-v2-header-rule"></div>
        <div class="cover-v2-header-right">
          ${companyLogo}
          <div class="cover-v2-company-name">${ctx.companyName}</div>
          <div class="cover-v2-company-tagline">${ctx.companyTagline}</div>
        </div>
      </header>

      <div class="cover-v2-hero">
        <div class="cover-v2-eyebrow"><span></span><em>BCL ONECAMPUS ERP</em><span></span></div>
        <h1 class="cover-v2-title">BCL <span class="cover-v2-title-accent">OneCampus</span> ERP</h1>
        <h2 class="cover-v2-subtitle">Enterprise Campus Management System</h2>
        <div class="cover-v2-hero-rule"></div>
        ${coverBuildingIllustration()}
        <p class="cover-v2-proposal-line">Proposal for Implementation, Annual Subscription &amp; Support</p>
        <div class="cover-v2-year-pill">
          <div class="cover-v2-year-icon">${coverInfoIcon('date')}</div>
          <div class="cover-v2-year-text">
            <span>ACADEMIC YEAR</span>
            <strong>${academicYear}</strong>
          </div>
        </div>
      </div>

      <div class="cover-v2-info-card">
        <div class="cover-v2-info-row">
          <div class="cover-v2-info-cell">
            <div class="cover-v2-info-icon">${coverInfoIcon('person')}</div>
            <div class="cover-v2-info-copy">
              <span>PREPARED FOR</span>
              <strong>${ctx.institutionName}</strong>
            </div>
          </div>
          <div class="cover-v2-info-split"></div>
          <div class="cover-v2-info-cell">
            <div class="cover-v2-info-icon">${coverInfoIcon('company')}</div>
            <div class="cover-v2-info-copy">
              <span>PREPARED BY</span>
              <strong>${ctx.companyName}</strong>
              <em>${ctx.companyTagline}</em>
            </div>
          </div>
        </div>
        <div class="cover-v2-info-hrule"></div>
        <div class="cover-v2-info-row">
          <div class="cover-v2-info-cell">
            <div class="cover-v2-info-icon">${coverInfoIcon('version')}</div>
            <div class="cover-v2-info-copy">
              <span>VERSION</span>
              <strong>${ctx.proposalVersion}</strong>
            </div>
          </div>
          <div class="cover-v2-info-split"></div>
          <div class="cover-v2-info-cell">
            <div class="cover-v2-info-icon">${coverInfoIcon('date')}</div>
            <div class="cover-v2-info-copy">
              <span>PROPOSAL DATE</span>
              <strong>${proposalDate}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="cover-v2-footer">
      <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg> ${ctx.companyWebsite}</span>
      <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg> ${ctx.companyEmail}</span>
      <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92V21a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012 5.18 2 2 0 014 3h4.09a2 2 0 012 1.72c.12.86.31 1.7.57 2.5a2 2 0 01-.45 2.11L9 10a16 16 0 006 6l.67-1.21a2 2 0 012.11-.45c.8.26 1.64.45 2.5.57A2 2 0 0122 16.92z"/></svg> ${ctx.companyPhone}</span>
    </footer>
  </div>`;
}
