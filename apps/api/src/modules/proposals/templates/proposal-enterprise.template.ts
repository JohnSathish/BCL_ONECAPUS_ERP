import { proposalStyles } from './proposal-template.styles';
import {
  isSectionEnabled,
  PROPOSAL_SECTIONS,
} from './proposal-template.sections';
import type { ProposalTemplateContext } from './proposal-template.types';

export type { ProposalTemplateContext } from './proposal-template.types';

const DEFAULT_COPY: Record<string, string> = {
  executiveSummary:
    'BCL OneCampus ERP is a unified academic and administration operating system purpose-built for colleges and universities. It digitizes every mission-critical function — admissions, NEP/FYUGP academics, examinations, fees & finance, HR, library, governance, NAAC/IQAC, official documents, research journals, college website CMS, Principal Desk analytics, and student/faculty mobile apps — in one governed platform. The result: less paperwork, faster decisions, and a modern public face for the institution.',
  implementation:
    'The implementation model combines process mapping, master data onboarding, role-based training, pilot execution, and institution-wide go-live with measurable adoption checkpoints across academic, finance, examination, website, and leadership teams.',
  support:
    'Support includes onboarding specialists, product success managers, SLA-backed issue resolution, release communications, quarterly governance reviews, and annual maintenance covering software updates, security patches, website/CMS content enablement, and database maintenance.',
};

export function resolveCopy(overrides?: Record<string, string>) {
  return { ...DEFAULT_COPY, ...(overrides ?? {}) };
}

export const PROPOSAL_SECTION_KEYS = PROPOSAL_SECTIONS.map((s) => s.key);

function renderTocPage(
  ctx: ProposalTemplateContext,
  entries: Array<{ num: number; title: string }>,
  pageNo: number,
) {
  return `<section class="page" id="toc">
    <div class="header"><strong>${ctx.institutionName}</strong><span>BCL OneCampus ERP</span></div>
    <h2>Table of Contents</h2>
    <ol class="toc toc-compact">
      ${entries.map((e) => `<li>${String(e.num).padStart(2, '0')}. ${e.title}</li>`).join('')}
    </ol>
    <div class="footer"><span>Table of Contents</span><span>Page ${pageNo}</span></div>
  </section>`;
}

function assignPageNumbers(html: string, pageNo: number) {
  let current = pageNo;
  return html.replace(/Page 0<\/span>/g, () => {
    const n = current;
    current += 1;
    return `Page ${n}</span>`;
  });
}

export function renderEnterpriseProposalHtml(ctx: ProposalTemplateContext) {
  const enabled = PROPOSAL_SECTIONS.filter((s) =>
    isSectionEnabled(ctx.sectionToggles, s.key),
  );

  const cover = enabled.find((s) => s.key === 'cover');
  const rest = enabled.filter((s) => s.key !== 'cover');

  let pageNo = 1;
  const coverHtml = cover
    ? assignPageNumbers(cover.render(ctx), pageNo).replace(
        '<section class="page"',
        '<section class="page" data-section="cover" id="section-cover"',
      )
    : '';
  if (cover) pageNo += 1;

  const tocEntries = rest.map((s, i) => ({
    num: i + 1,
    title: s.tocTitle,
  }));
  const tocHtml = renderTocPage(ctx, tocEntries, pageNo);
  pageNo += 1;

  const bodyPages = rest
    .map((section) => {
      const html = assignPageNumbers(section.render(ctx), pageNo).replace(
        '<section class="page"',
        `<section class="page" data-section="${section.key}" id="section-${section.key}"`,
      );
      pageNo += 1;
      return html;
    })
    .join('\n');

  const totalPages = pageNo - 1;

  const allPages = [coverHtml, tocHtml, bodyPages].filter(Boolean).join('\n');
  const numbered = allPages.replace(
    /<span>Page (\d+)<\/span>/g,
    (_, n) => `<span>Page ${n} of ${totalPages}</span>`,
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BCL OneCampus ERP Proposal — ${ctx.institutionName}</title>
    <style>${proposalStyles(ctx.primaryColor, ctx.secondaryColor)}</style>
  </head>
  <body>
    ${numbered}
  </body>
</html>`;
}
