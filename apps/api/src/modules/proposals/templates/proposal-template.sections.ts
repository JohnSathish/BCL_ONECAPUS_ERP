import type { ProposalTemplateContext } from './proposal-template.types';
import { renderProposalCover } from './proposal-cover.template';

export type ProposalSectionDef = {
  key: string;
  tocTitle: string;
  /** Legacy keys that map to this section for studio toggles. */
  aliases?: string[];
  render: (ctx: ProposalTemplateContext) => string;
};

function inr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function footerBrand(ctx: ProposalTemplateContext) {
  return `<div class="footer-brand compact">
    <strong>${ctx.companyName}</strong>
    <span>${ctx.companyTagline}</span>
    <div class="footer-contacts">
      <span class="footer-contact-item">✉ ${ctx.companyEmail}</span>
      <span class="footer-contact-item">☎ ${ctx.companyPhone}</span>
      <span class="footer-contact-item">🌐 ${ctx.companyWebsiteLabel}</span>
    </div>
  </div>`;
}

function page(
  ctx: ProposalTemplateContext,
  pageNo: number,
  label: string,
  body: string,
) {
  if (label === 'Cover') {
    return `<section class="page page--cover" id="section-${pageNo}">${body}</section>`;
  }

  const bclLogo = ctx.bclLogoDataUri
    ? `<img class="logo-sm" src="${ctx.bclLogoDataUri}" alt="${ctx.companyName}" />`
    : '';
  return `<section class="page" id="section-${pageNo}">
    <div class="header">
      <div style="display:flex;align-items:center;gap:8px;">
        ${bclLogo}
        <div>
          <strong>${ctx.institutionName}</strong>
          <div class="small">BCL OneCampus ERP</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="small">${ctx.companyName}</div>
        <div class="small">${ctx.companyWebsiteLabel}</div>
      </div>
    </div>
    <div class="page-content">${body}</div>
    <div class="footer">
      <div style="display:flex;align-items:center;gap:8px;">
        ${bclLogo}
        ${footerBrand(ctx)}
      </div>
      <span>${label} · Page ${pageNo}</span>
    </div>
  </section>`;
}

function moduleCard(icon: string, title: string, desc: string) {
  return `<div class="card card-compact no-break"><div class="card-icon">${icon}</div><strong>${title}</strong><p>${desc}</p></div>`;
}

function chip(label: string) {
  return `<div class="chip-box">${label}</div>`;
}

export const PROPOSAL_SECTIONS: ProposalSectionDef[] = [
  {
    key: 'cover',
    tocTitle: 'Cover Page',
    render: (ctx) =>
      page(
        ctx,
        0,
        'Cover',
        `<div class="cover-page">${renderProposalCover(ctx)}</div>`,
      ),
  },
  {
    key: 'letter',
    tocTitle: 'Letter of Submission',
    render: (ctx) =>
      page(
        ctx,
        0,
        'Letter of Submission',
        `<h2>Letter of Submission</h2>
        <p>To,<br/><strong>The Principal</strong><br/>${ctx.institutionName}<br/>${ctx.addressLine}</p>
        <p>Dear ${ctx.contactPerson},</p>
        <p>We are honoured to submit this enterprise proposal for implementing <strong>BCL OneCampus ERP</strong> at ${ctx.institutionName}. Your institution's commitment to academic excellence and administrative modernization aligns with our vision of building governed, scalable, and future-ready campus platforms.</p>
        <p>This proposal outlines a practical digital transformation roadmap — from admissions and academics to finance, examinations, mobile engagement, and leadership analytics — designed to reduce manual dependency and strengthen institutional governance.</p>
        <p>${ctx.companyName} brings higher-education domain expertise, proven implementation methodology, and long-term partnership support. We look forward to partnering with ${ctx.institutionName}.</p>
        <p style="margin-top:18px;">Sincerely,<br/><strong>${ctx.companyName}</strong><br/>${ctx.companyEmail} · ${ctx.companyPhone}<br/>${ctx.companyWebsite}</p>`,
      ),
  },
  {
    key: 'executive-summary',
    tocTitle: 'Executive Summary',
    render: (ctx) =>
      page(
        ctx,
        0,
        'Executive Summary',
        `<h2>Executive Summary</h2>
        <p>${ctx.copy.executiveSummary}</p>
        <div class="grid-2">
          <div class="card card-compact"><h3>Current Challenges</h3><ul>
            <li>Excel dependency and fragmented spreadsheets</li>
            <li>Manual registers and paper files</li>
            <li>Duplicate data entry across departments</li>
            <li>Slow report generation for management</li>
          </ul></div>
          <div class="card card-compact"><h3>Proposed Solution &amp; Benefits</h3><ul>
            <li>Unified BCL OneCampus ERP platform</li>
            <li>End-to-end automation workflows</li>
            <li>Student, faculty &amp; parent mobile apps</li>
            <li>Secure centralized database &amp; instant reports</li>
          </ul></div>
        </div>
        <div class="grid-3 no-break" style="margin-top:8px;">
          <div class="card card-compact"><div class="kpi">95%</div><div class="small">reduction in manual paperwork</div></div>
          <div class="card card-compact"><div class="kpi">2.8x</div><div class="small">faster management reporting</div></div>
          <div class="card card-compact"><div class="kpi">360°</div><div class="small">student lifecycle visibility</div></div>
        </div>`,
      ),
  },
  {
    key: 'about-bcl',
    tocTitle: 'About BCL & Why OneCampus',
    aliases: ['digital-transformation', 'why-bcl'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'About BCL & Why OneCampus',
        `<h2>About ${ctx.companyName}</h2>
        <p>${ctx.companyName} specializes in enterprise software for educational institutions — designing, implementing, and supporting mission-critical campus platforms with modern UX and robust governance. <span class="small">${ctx.companyTagline}</span></p>
        <div class="grid-2">
          <div class="card card-compact"><h3>Mission</h3><p>Empower colleges with intelligent, secure, and scalable digital infrastructure.</p></div>
          <div class="card card-compact"><h3>Vision</h3><p>Become the most trusted campus technology partner in Northeast India and beyond.</p></div>
        </div>
        <div class="grid-3" style="margin-top:8px;">
          ${moduleCard('🎓', 'ERP Development', 'Full-stack campus ERP platforms')}
          ${moduleCard('📱', 'Mobile Applications', 'Student, faculty & parent apps')}
          ${moduleCard('🛠️', 'Support Services', 'SLA-backed maintenance & training')}
        </div>

        <h2 style="margin-top:12px;">Why Digital Transformation?</h2>
        <div class="flow flow-compact">
          <div class="flow-box">Manual System</div><div class="flow-arrow">→</div>
          <div class="flow-box">Excel / Paper</div><div class="flow-arrow">→</div>
          <div class="flow-box">Errors &amp; Delays</div><div class="flow-arrow">→</div>
          <div class="flow-box flow-highlight">BCL OneCampus ERP</div><div class="flow-arrow">→</div>
          <div class="flow-box">Automation &amp; Real-Time Insights</div>
        </div>

        <h2 style="margin-top:10px;">Why Choose BCL OneCampus ERP?</h2>
        <div class="grid-2">
          ${[
            [
              'Built for Higher Education',
              'Purpose-designed for colleges and universities',
            ],
            [
              'NEP 2020 FYUGP Ready',
              'Curriculum and progression aligned to NEP',
            ],
            ['NEHU Compatible', 'Examination and academic workflows for NEHU'],
            [
              'Modular & Cloud Ready',
              'Progressive rollout with secure hosting',
            ],
            ['Mobile Apps', 'Student, faculty & parent engagement'],
            ['Enterprise Reports', 'PDF, Excel & dashboard analytics'],
          ]
            .map(([t, d]) => moduleCard('✓', t, d))
            .join('')}
        </div>`,
      ),
  },
  {
    key: 'architecture',
    tocTitle: 'Architecture & ERP Modules',
    aliases: ['erp-modules-1', 'erp-modules-2', 'erp-modules-3'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'Architecture & Modules',
        `<h2>System Architecture</h2>
        <div class="arch-diagram arch-compact">
          <div class="arch-row">
            ${['Students', 'Faculty', 'Parents', 'Office Staff', 'Principal'].map((r) => `<div class="arch-box">${r}</div>`).join('')}
          </div>
          <div class="flow-arrow">↓</div>
          <div class="arch-core">BCL OneCampus ERP</div>
          <div class="flow-arrow">↓</div>
          <div class="arch-row">
            ${['Backend Services', 'PostgreSQL', 'Cloud Backup', 'Reports', 'Mobile Apps', 'AI Assistant'].map((r) => `<div class="arch-box">${r}</div>`).join('')}
          </div>
        </div>

        <h2 style="margin-top:10px;">ERP Modules Overview</h2>
        <div class="grid-4">
          ${[
            ['📝', 'Admissions'],
            ['👥', 'Student Mgmt'],
            ['📚', 'Academics'],
            ['🗺️', 'Curriculum'],
            ['📋', 'Registration'],
            ['✅', 'Attendance'],
            ['📊', 'Examinations'],
            ['💰', 'Fee Mgmt'],
            ['🏦', 'Finance'],
            ['👔', 'HR'],
            ['📄', 'Documents'],
            ['🎖️', 'Certificates'],
            ['📈', 'Reports'],
            ['📉', 'Analytics'],
            ['🤖', 'AI Assistant'],
            ['📱', 'Mobile Apps'],
            ['🏛️', 'Governance'],
            ['📖', 'Library'],
          ]
            .map(
              ([icon, title]) =>
                `<div class="card card-compact module-tile"><div class="card-icon">${icon}</div><strong>${title}</strong></div>`,
            )
            .join('')}
        </div>`,
      ),
  },
  {
    key: 'academic',
    tocTitle: 'Academic, Fees & Finance',
    aliases: ['fees', 'finance'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'Academic, Fees & Finance',
        `<h2>Academic Module</h2>
        <p>Complete student lifecycle management from admission through graduation with NEP-aligned academic structures.</p>
        <div class="chip-row">
          ${['Admission', 'Registration', 'Promotion', 'Attendance', 'Examination', 'Graduation'].map(chip).join('')}
        </div>
        <div class="grid-2" style="margin-top:8px;">
          <div class="card card-compact"><h3>Student Profile</h3><p>Academics, attendance, fee, and examination insights in one profile.</p></div>
          <div class="card card-compact"><h3>Academic Dashboard</h3><p>Program-wise analytics, performance trends, and progress tracking.</p></div>
        </div>

        <h2 style="margin-top:12px;">Fee Management</h2>
        <div class="grid-2">
          <div class="card card-compact"><h3>Capabilities</h3><ul>
            <li>Fee structure &amp; monthly plans</li>
            <li>Demand generation &amp; collection center</li>
            <li>Scholarships, concessions &amp; student ledger</li>
            <li>Online payment, receipts &amp; defaulter intelligence</li>
          </ul></div>
          <div class="card card-compact"><h3>Fee Collection Intelligence</h3><p>Track real-time collections, dues, concessions, and cashflow trends across periods.</p></div>
        </div>

        <h2 style="margin-top:12px;">Finance &amp; Accounts</h2>
        <div class="chip-row">
          ${['Chart of Accounts', 'Vouchers', 'Cash / Bank Book', 'General Ledger', 'Trial Balance', 'Income & Expenditure', 'Balance Sheet', 'Budgets', 'Expenses', 'Vendors', 'Bank Reconciliation'].map(chip).join('')}
        </div>`,
      ),
  },
  {
    key: 'examination',
    tocTitle: 'Exams, Mobile Apps & Leadership',
    aliases: ['student-app', 'faculty-app', 'principal-dashboard'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'Exams, Mobile & Leadership',
        `<h2>Examination Module</h2>
        <div class="grid-2">
          <ul>
            <li>Exam session planning and IA timetable management</li>
            <li>Student registration and admit card workflows</li>
            <li>Semester examination fees and back paper handling</li>
            <li>Mark entry, defaulter tracking, and result analytics</li>
            <li>University submission exports (NEHU compatible)</li>
          </ul>
          <div class="card card-compact"><h3>Examination Analytics</h3><p>Result distribution, defaulter patterns, and performance intelligence by semester.</p></div>
        </div>

        <h2 style="margin-top:10px;">Mobile Applications</h2>
        <div class="grid-2">
          <div class="card card-compact"><h3>Student App</h3><ul>
            <li>Attendance, timetable &amp; academic calendar</li>
            <li>Fee payment, receipts &amp; results</li>
            <li>Notices, notifications &amp; LMS access</li>
          </ul></div>
          <div class="card card-compact"><h3>Faculty App</h3><ul>
            <li>Attendance marking &amp; marks entry</li>
            <li>Timetable, teaching load &amp; leave</li>
            <li>Circulars, assignments &amp; student lists</li>
          </ul></div>
        </div>

        <h2 style="margin-top:10px;">Principal Dashboard</h2>
        <div class="grid-3">
          ${[
            ['Student Strength', ctx.studentStrength.toLocaleString('en-IN')],
            ['Admissions', 'Live intake tracking'],
            ['Fee Collection', 'Daily & monthly trends'],
            ['Attendance', 'Shift-wise analytics'],
            ['Department Performance', 'Comparative KPIs'],
            ['Budget Utilization', 'Spend vs allocation'],
          ]
            .map(
              ([k, v]) =>
                `<div class="card card-compact"><div class="small">${k}</div><div class="kpi kpi-sm">${v}</div></div>`,
            )
            .join('')}
        </div>`,
      ),
  },
  {
    key: 'ai',
    tocTitle: 'AI, Reports & Analytics',
    aliases: ['reports'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'AI, Reports & Analytics',
        `<h2>Artificial Intelligence</h2>
        <p>Natural language search across institutional data — ask questions in plain English and receive governed, permission-aware answers.</p>
        <div class="grid-2">
          ${[
            "Show today's fee collection",
            'Show Semester V students',
            'Generate attendance report',
            'Find fee defaulters',
            'Explain syllabus structure',
            "Show today's expenses",
            'Generate Trial Balance',
            'List pending admissions',
          ]
            .map(
              (q) =>
                `<div class="card card-compact" style="font-size:12px;">"${q}"</div>`,
            )
            .join('')}
        </div>

        <h2 style="margin-top:12px;">Reports &amp; Analytics</h2>
        <div class="grid-3">
          ${[
            'Admission Reports',
            'Attendance Reports',
            'Fee Reports',
            'Finance Reports',
            'Academic Reports',
            'Examination Reports',
          ]
            .map((r) => moduleCard('📊', r, 'PDF · Excel · Charts'))
            .join('')}
        </div>
        <p class="small" style="margin-top:6px;">All reports support institutional branding, export formats, and scheduled distribution.</p>`,
      ),
  },
  {
    key: 'timeline',
    tocTitle: 'Implementation & Support',
    aliases: ['support'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'Implementation & Support',
        `<h2>Implementation Timeline</h2>
        <div class="grid-2">
          ${[
            [
              'Phase 1',
              'Requirement Analysis',
              'Process mapping, workshops, scope charter',
            ],
            [
              'Phase 2',
              'Configuration',
              'Module setup, master data, role matrix',
            ],
            [
              'Phase 3',
              'Data Migration',
              'Student, staff, academic & fee onboarding',
            ],
            [
              'Phase 4',
              'Testing',
              'UAT, integration validation, security review',
            ],
            ['Phase 5', 'Training', 'Department training & documentation'],
            ['Phase 6', 'Go Live', 'Production launch with hypercare'],
          ]
            .map(
              ([phase, title, desc]) =>
                `<div class="timeline-item"><strong>${phase}: ${title}</strong><div class="small">${desc}</div></div>`,
            )
            .join('')}
        </div>
        <p class="small">${ctx.copy.implementation}</p>

        <h2 style="margin-top:10px;">Support &amp; Maintenance</h2>
        <p>${ctx.copy.support}</p>
        <div class="chip-row">
          ${['Remote Support', 'Software Updates', 'Bug Fixes', 'Security Updates', 'Database Maintenance', 'User Training', 'Priority Support', 'Documentation', 'Annual Maintenance'].map(chip).join('')}
        </div>
        <div class="grid-3 no-break" style="margin-top:8px;">
          <div class="card card-compact"><div class="kpi">99.5%</div><div class="small">target uptime</div></div>
          <div class="card card-compact"><div class="kpi">&lt; 4h</div><div class="small">critical SLA response</div></div>
          <div class="card card-compact"><div class="kpi">Quarterly</div><div class="small">governance reviews</div></div>
        </div>`,
      ),
  },
  {
    key: 'subscription',
    tocTitle: 'Subscription & ROI',
    aliases: ['roi'],
    render: (ctx) => {
      const subscriptionTotal =
        ctx.studentStrength * ctx.perStudentSubscriptionRate;
      const otherLines = ctx.pricingLines.filter(
        (line) => !line.label.toLowerCase().includes('annual erp subscription'),
      );
      const total =
        subscriptionTotal +
        otherLines.reduce((sum, line) => sum + line.amount, 0);
      return page(
        ctx,
        0,
        'Subscription & ROI',
        `<h2>Annual Subscription</h2>
        <table>
          <thead><tr><th>Component</th><th>Details</th><th>Amount</th></tr></thead>
          <tbody>
            <tr>
              <td>Annual ERP Subscription</td>
              <td>₹${ctx.perStudentSubscriptionRate.toLocaleString('en-IN')} × ${ctx.studentStrength.toLocaleString('en-IN')} students</td>
              <td>${inr(subscriptionTotal)}</td>
            </tr>
            ${otherLines.map((l) => `<tr><td>${l.label}</td><td>Annual / One-time</td><td>${inr(l.amount)}</td></tr>`).join('')}
            <tr><th colspan="2">Total Commercial Value</th><th>${inr(total)}</th></tr>
          </tbody>
        </table>
        <div class="grid-2" style="margin-top:8px;">
          <ul>
            <li>Full ERP access for authorized users</li>
            <li>Student, Faculty &amp; Parent mobile apps</li>
            <li>Software updates &amp; feature enhancements</li>
            <li>Technical support &amp; database maintenance</li>
            <li>Security updates &amp; user training sessions</li>
          </ul>
          <div class="card card-compact">
            <div class="small">Per-Student Rate</div>
            <div class="kpi kpi-sm">${inr(ctx.perStudentSubscriptionRate)}</div>
            <div class="small" style="margin-top:6px;">Estimated Students</div>
            <div class="kpi kpi-sm">${ctx.studentStrength.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <h2 style="margin-top:10px;">Return on Investment</h2>
        <table>
          <thead><tr><th>Aspect</th><th>Without ERP</th><th>With BCL OneCampus ERP</th></tr></thead>
          <tbody>
            ${[
              ['Data Management', 'Excel spreadsheets', 'Centralized database'],
              ['Records', 'Manual registers', 'Paperless workflows'],
              ['Operations', 'Duplicate work', 'Automated processes'],
              ['Reporting', 'Slow manual reports', 'Instant PDF/Excel reports'],
              ['Access', 'Office-bound', 'Mobile access anywhere'],
              ['Leadership', 'Delayed visibility', 'Real-time dashboard'],
            ]
              .map(
                ([a, no, yes]) =>
                  `<tr><td>${a}</td><td class="compare-no">${no}</td><td class="compare-yes">${yes}</td></tr>`,
              )
              .join('')}
          </tbody>
        </table>`,
      );
    },
  },
  {
    key: 'terms',
    tocTitle: 'Terms & Conditions',
    render: (ctx) =>
      page(
        ctx,
        0,
        'Terms & Conditions',
        `<h2>Terms &amp; Conditions</h2>
        <ul>
          <li><strong>Payment Terms:</strong> Subscription fees payable annually in advance unless otherwise agreed.</li>
          <li><strong>Renewal:</strong> Auto-renewal with 30-day prior notice for rate adjustments.</li>
          <li><strong>Support Policy:</strong> Remote support during business hours; priority SLA for critical issues.</li>
          <li><strong>Data Ownership:</strong> All institutional data remains property of ${ctx.institutionName}.</li>
          <li><strong>Confidentiality:</strong> Both parties maintain strict confidentiality of proprietary information.</li>
          <li><strong>Termination:</strong> Either party may terminate with 90-day written notice.</li>
          <li><strong>Force Majeure:</strong> Neither party liable for delays due to events beyond reasonable control.</li>
          <li><strong>Software Usage Rights:</strong> Non-exclusive, non-transferable license for institutional use.</li>
          <li><strong>Liability:</strong> Limited to fees paid in the preceding 12-month period.</li>
        </ul>`,
      ),
  },
  {
    key: 'acceptance',
    tocTitle: 'Thank You & Acceptance',
    aliases: ['thank-you'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'Thank You & Acceptance',
        `<div class="thank-you thank-you-compact">
          ${ctx.bclLogoDataUri ? `<img class="logo" src="${ctx.bclLogoDataUri}" alt="${ctx.companyName}" style="margin:0 auto 8px;" />` : ''}
          <h1>Thank You</h1>
          <p>We appreciate your time and consideration. Our team is ready to assist with any questions.</p>
          <p><strong>${ctx.companyName}</strong> · ${ctx.companyTagline}<br/>
          <a href="${ctx.companyWebsite}">${ctx.companyWebsiteLabel}</a> · ${ctx.companyEmail} · ${ctx.companyPhone}</p>
          <div class="qr-wrap">
            ${ctx.qrCodeUrl ? `<img class="qr-image" src="${ctx.qrCodeUrl}" alt="QR code for ${ctx.companyWebsite}" />` : `<div class="qr-box">${ctx.companyWebsiteLabel}</div>`}
            <p class="small" style="margin-top:4px;">Scan to visit ${ctx.companyWebsiteLabel}</p>
          </div>
        </div>

        <h2 style="margin-top:14px;">Acceptance</h2>
        <p>By signing below, both parties agree to the terms outlined in this proposal for implementing BCL OneCampus ERP at ${ctx.institutionName}.</p>
        <div class="signature-box">
          <div>
            <p><strong>Prepared By</strong></p>
            <p>${ctx.companyName}</p>
            <p class="small">${ctx.companyEmail} · ${ctx.companyPhone}</p>
            <div class="line">Authorized Signatory</div>
            <p class="small">Date: _______________</p>
          </div>
          <div>
            <p><strong>Accepted By</strong></p>
            <p>${ctx.contactPerson}, ${ctx.institutionName}</p>
            <div class="line">Signature &amp; Seal</div>
            <p class="small">Date: _______________</p>
          </div>
        </div>`,
      ),
  },
];

export function isSectionEnabled(
  toggles: Record<string, boolean>,
  key: string,
): boolean {
  if (toggles[key] === false) return false;
  const section = PROPOSAL_SECTIONS.find((s) => s.key === key);
  if (!section?.aliases?.length) {
    // Unset keys default to enabled; only explicit false disables (handled above).
    return true;
  }
  // If any alias is explicitly disabled and the main key is unset, still show
  // unless the main key itself is false (handled above).
  return true;
}
