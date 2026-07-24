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
        <p>We are honoured to submit this updated enterprise proposal for implementing <strong>BCL OneCampus ERP</strong> at ${ctx.institutionName}. Your institution's commitment to academic excellence, NAAC quality culture, and public digital presence aligns with our vision of building governed, scalable, and future-ready campus platforms.</p>
        <p>This proposal outlines a complete digital transformation roadmap — covering admissions, NEP/FYUGP academics, examinations, fees &amp; finance, HR, library, governance, official documents, research journals, the college website CMS, Principal Desk leadership analytics, and student/faculty mobile apps — designed to reduce manual dependency and strengthen institutional governance.</p>
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
            <li>End-to-end automation across academics, fees &amp; exams</li>
            <li>Student &amp; faculty mobile apps + Principal Desk</li>
            <li>College website CMS, NAAC/IQAC &amp; journals support</li>
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
              'Morning & Day Shift Ready',
              'Built for multi-shift college operations',
            ],
            [
              'Modular & Cloud Ready',
              'Progressive rollout with secure hosting',
            ],
            ['Mobile Apps', 'Student & faculty engagement on Android'],
            ['Website CMS', 'Public college site managed from the ERP'],
            ['NAAC / IQAC Ready', 'Evidence vault, AQAR & governance trail'],
            ['Enterprise Reports', '200+ reports · PDF, Excel & dashboards'],
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
            ${['Backend Services', 'PostgreSQL', 'Cloud Backup', 'Reports', 'Mobile Apps', 'Website CMS', 'AI Assistant'].map((r) => `<div class="arch-box">${r}</div>`).join('')}
          </div>
        </div>

        <h2 style="margin-top:10px;">ERP Modules Overview</h2>
        <div class="grid-4">
          ${[
            ['📝', 'Admissions'],
            ['👥', 'Student Mgmt'],
            ['📚', 'Academics / NEP'],
            ['🗺️', 'Curriculum'],
            ['📋', 'Registration'],
            ['✅', 'Attendance'],
            ['📊', 'Examinations'],
            ['💰', 'Fee Mgmt'],
            ['🏦', 'Finance'],
            ['👔', 'HR & Payroll'],
            ['📄', 'Official Docs'],
            ['🎖️', 'Certificates'],
            ['📖', 'Library'],
            ['🏛️', 'Governance'],
            ['🏅', 'NAAC / IQAC'],
            ['🌐', 'Website CMS'],
            ['📰', 'News & Notices'],
            ['🔬', 'Journals'],
            ['🤖', 'AI Assistant'],
            ['📱', 'Mobile Apps'],
            ['📈', 'Reports'],
            ['🧭', 'Principal Desk'],
            ['🏠', 'Hostel'],
            ['🚌', 'Transport'],
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
    key: 'modules-detail-1',
    tocTitle: 'Module Details (Part 1)',
    aliases: ['module-catalogue', 'modules-detail'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'Module Details (Part 1)',
        `<h2>Detailed Module Catalogue</h2>
        <p class="small">Each module below is part of BCL OneCampus ERP for ${ctx.institutionName}. Concise descriptions are provided for Principal-level review.</p>
        <div class="grid-2" style="margin-top:8px;">
          ${[
            [
              'Admissions',
              'Online applications, document & payment verification, merit processing, intake analytics, and admission-to-enrolment workflow.',
            ],
            [
              'Student Management',
              'Central student directory, profiles, bulk import/export, photos, promotion, transfer, re-admission, and ABC ID capture.',
            ],
            [
              'Academics / NEP',
              'NEP 2020 FYUGP academic engine with major/minor/MDC/AEC/SEC/VAC structures, credit ledger, and Morning & Day shift support.',
            ],
            [
              'Curriculum',
              'Programme and course structures, curriculum mapping, syllabus repository, and outcome-linked academic planning.',
            ],
            [
              'Registration',
              'Semester subject registration with seat rules, FCFS allocation where applicable, and registration status tracking.',
            ],
            [
              'Attendance',
              'Student and staff attendance capture, shift-wise analytics, defaulter visibility, and biometric-ready staff attendance.',
            ],
            [
              'Examinations',
              'IA planning, timetable, mark entry, admit cards, result analytics, and NEHU-compatible university submission exports.',
            ],
            [
              'Fee Management',
              'Fee structures, demand, collection, scholarships, concessions, student ledger, online pay, defaulters, and fee reconciliation.',
            ],
            [
              'Finance & Accounts',
              'Chart of accounts, vouchers, cash/bank books, ledger, trial balance, I&E, balance sheet, budgets, vendors, and bank reconciliation.',
            ],
            [
              'HR & Payroll',
              'Staff directory, recruitment, leave, substitutes, attendance, service records, appraisal, and payroll/payslip workflows.',
            ],
            [
              'Official Documents',
              'Institutional notices, circulars, office orders, templates, e-signature workflow, and controlled document archive.',
            ],
            [
              'Certificates',
              'Bonafide, transfer, conduct and related certificates, ID card designer, bulk print, and public verification support.',
            ],
          ]
            .map(([t, d]) => moduleCard('▸', t, d))
            .join('')}
        </div>`,
      ),
  },
  {
    key: 'modules-detail-2',
    tocTitle: 'Module Details (Part 2)',
    render: (ctx) =>
      page(
        ctx,
        0,
        'Module Details (Part 2)',
        `<h2>Detailed Module Catalogue <span class="small">(continued)</span></h2>
        <div class="grid-2">
          ${[
            [
              'Library',
              'Catalogue, issue/return, fines, digital/research resources, and NAAC-oriented library reporting.',
            ],
            [
              'Governance',
              'Committees, meetings, action-taken reports, governance notices, and leadership oversight of institutional bodies.',
            ],
            [
              'NAAC / IQAC',
              'Criteria tracking, evidence vault, AQAR readiness, DVV support, achievements, MoUs, and quality dashboards.',
            ],
            [
              'Website CMS',
              'College website content management — pages, menus, media, SEO, homepage builder, and controlled publishing from the ERP.',
            ],
            [
              'News & Notices',
              'News, notice board, announcements, flash news, and public communication updates for students and visitors.',
            ],
            [
              'Journals',
              'Peer-reviewed journal workflows: manuscript submission, review, revisions, production, DOI/metadata, and author dashboards.',
            ],
            [
              'AI Assistant',
              'Natural-language institutional queries for fee, attendance, admissions, and report insights with permission-aware answers.',
            ],
            [
              'Mobile Apps',
              'Android apps for students and faculty — attendance, fees, results, timetable, leave, notices, and push notifications.',
            ],
            [
              'Reports',
              '200+ institutional reports across admissions, academics, fees, exams, finance, and departments — PDF and Excel export.',
            ],
            [
              'Principal Desk',
              'Leadership command center for strength, fees, attendance, exams, leave approvals, committees, NAAC pulse, and notices.',
            ],
            [
              'Hostel',
              'Hostel operations including room allocation, occupancy visibility, and hostel fee linkage where configured.',
            ],
            [
              'Transport',
              'Transport route and vehicle operations support for campus commuting and related administrative tracking.',
            ],
          ]
            .map(([t, d]) => moduleCard('▸', t, d))
            .join('')}
        </div>
        <div class="card card-compact no-break" style="margin-top:10px;">
          <h3>Dedicated Research Journal Websites</h3>
          <p>In addition to the Journals module inside OneCampus, BaseCode Labs is developing <strong>dedicated public websites</strong> for the college research journals — including <strong>Transient</strong> and other journal portals — with branded author/reader experience, submission entry points, and editorial visibility aligned to each journal’s identity.</p>
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
        <p>Complete student lifecycle management from admission through graduation with NEP 2020 / FYUGP-aligned academic structures, ABC ID support, and Morning &amp; Day shift operations.</p>
        <div class="chip-row">
          ${['Online Admissions', 'Student Information', 'NEP Academic Engine', 'Curriculum Mapping', 'Subject Registration', 'Morning & Day Shift', 'Promotion', 'Attendance', 'Timetable', 'Internal Assessment', 'Examination', 'Result Processing', 'Transcript & Grade Card', 'ABC ID'].map(chip).join('')}
        </div>
        <div class="grid-2" style="margin-top:8px;">
          <div class="card card-compact"><h3>Student Lifecycle</h3><ul>
            <li>Online applications, merit &amp; document verification</li>
            <li>Directory, bulk import, photos, transfer &amp; re-admission</li>
            <li>Programme, curriculum &amp; semester management</li>
            <li>Timetable engine, LMS, assignments &amp; quizzes</li>
            <li>Question bank, syllabus repository &amp; OBE hooks</li>
          </ul></div>
          <div class="card card-compact"><h3>Academic Dashboard</h3><p>Program-wise analytics, performance trends, credit ledger visibility, and progress tracking for HODs and leadership.</p></div>
        </div>

        <h2 style="margin-top:12px;">Fee Management</h2>
        <div class="grid-2">
          <div class="card card-compact"><h3>Capabilities</h3><ul>
            <li>Fee structure — admission, semester &amp; examination fees</li>
            <li>Demand generation &amp; collection center</li>
            <li>Scholarships, concessions &amp; student ledger</li>
            <li>Online payment, receipts &amp; daily collection reports</li>
            <li>Fee defaulter intelligence &amp; examination / back-paper fees</li>
            <li><strong>Fee reconciliation</strong> — match collections, demands, ledger balances, and bank / gateway settlements for accurate period closing</li>
          </ul></div>
          <div class="card card-compact"><h3>Fee Collection Intelligence</h3><p>Track real-time collections, dues, concessions, and cashflow trends across periods — visible to accounts and the Principal Desk. Reconciliation tools help accounts verify that what was demanded, collected, and settled is consistent and audit-ready.</p></div>
        </div>

        <h2 style="margin-top:12px;">Finance &amp; Accounts</h2>
        <div class="chip-row">
          ${['Chart of Accounts', 'Vouchers', 'Cash Book', 'Bank Book', 'General Ledger', 'Trial Balance', 'Income & Expenditure', 'Balance Sheet', 'Budgets', 'Vendors', 'Expense Tracking', 'Bank Reconciliation', 'Financial Reports'].map(chip).join('')}
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
          <div class="card card-compact"><h3>Examination Analytics</h3><p>Result distribution, defaulter patterns, and performance intelligence by semester for academic leadership.</p></div>
        </div>

        <h2 style="margin-top:10px;">Mobile Applications (Android)</h2>
        <div class="grid-2">
          <div class="card card-compact"><h3>Student App</h3><ul>
            <li>Attendance, timetable &amp; academic calendar</li>
            <li>Fee payment, receipts, results &amp; exam fees</li>
            <li>Library, leave, certificates &amp; assignments</li>
            <li>Syllabus, notices, push notifications &amp; QR/RFID login</li>
          </ul></div>
          <div class="card card-compact"><h3>Faculty App</h3><ul>
            <li>Attendance marking &amp; marks entry</li>
            <li>Timetable, teaching load &amp; leave</li>
            <li>Payroll / payslips &amp; circulars</li>
            <li>Student roster &amp; push preferences</li>
          </ul></div>
        </div>

        <h2 style="margin-top:10px;">Principal Desk</h2>
        <p>A leadership command center for institutional health without requiring full admin complexity.</p>
        <div class="grid-3">
          ${[
            ['Student Strength', ctx.studentStrength.toLocaleString('en-IN')],
            ['Admissions', 'Live intake tracking'],
            ['Fee Collection', 'Daily & monthly trends'],
            ['Attendance', 'Shift-wise analytics'],
            ['Exams & Results', 'IA & semester visibility'],
            ['Leave Approvals', 'Staff & student workflows'],
            ['Committees / Events', 'Governance overview'],
            ['NAAC Readiness', 'Evidence & quality pulse'],
            ['Notices', 'Institutional communications'],
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
    key: 'website-governance',
    tocTitle: 'Website, Journals & Governance',
    aliases: ['website', 'journals', 'naac', 'governance'],
    render: (ctx) =>
      page(
        ctx,
        0,
        'Website, Journals & Governance',
        `<h2>College Website CMS</h2>
        <p>A modern public website for ${ctx.institutionName}, managed from the ERP — so notices, news, and institutional pages stay accurate without depending on external vendors for every edit.</p>
        <div class="grid-2">
          <div class="card card-compact"><h3>Public Website</h3><ul>
            <li>Homepage builder, hero slider &amp; branding</li>
            <li>About Us, Administration, Academics &amp; Campus Life</li>
            <li>News, notice board, announcements &amp; gallery</li>
            <li>Departments, faculty profiles &amp; programmes</li>
            <li>Governing Body, Organogram, IQAC, NAAC, NIRF, AISHE &amp; more</li>
            <li>Contact forms, newsletter &amp; ERP login link</li>
          </ul></div>
          <div class="card card-compact"><h3>CMS Controls</h3><ul>
            <li>Pages, media library &amp; document uploads</li>
            <li>Menus, SEO, publishing &amp; revisions</li>
            <li>FYUG interest / admission enquiry capture</li>
            <li>Blood donor registry &amp; public forms</li>
            <li>Role-based editors with publish workflow</li>
          </ul></div>
        </div>

        <h2 style="margin-top:12px;">Research Journals &amp; Dedicated Journal Websites</h2>
        <div class="grid-2">
          <div class="card card-compact"><h3>Journals Module (ERP)</h3><ul>
            <li>Manuscript submission &amp; author dashboard</li>
            <li>Peer review, revisions &amp; editorial decisions</li>
            <li>Production workflow &amp; issue publishing</li>
            <li>DOI / metadata &amp; OAI harvesting support</li>
          </ul></div>
          <div class="card card-compact"><h3>Dedicated Journal Websites</h3><ul>
            <li><strong>Transient</strong> — dedicated public journal website under development</li>
            <li>Additional college journal website(s) with journal-specific branding</li>
            <li>Author guidelines, archives, and submission entry points</li>
            <li>Integrated with OneCampus journal editorial workflows</li>
          </ul></div>
        </div>
        <p class="small" style="margin-top:6px;">This gives ${ctx.institutionName} both a strong public research presence and a governed back-office for peer review and publication.</p>

        <h2 style="margin-top:12px;">Governance, NAAC / IQAC &amp; Official Documents</h2>
        <div class="grid-3">
          ${[
            ['Governance', 'Committees, meetings, ATR &amp; notices'],
            ['NAAC / IQAC', 'Criteria, evidence vault, AQAR &amp; DVV'],
            [
              'Official Documents',
              'Notices, circulars, office orders &amp; e-sign',
            ],
            [
              'HR &amp; Payroll',
              'Leave, substitutes, appraisal &amp; payslips',
            ],
            ['Library', 'Catalogue, circulation &amp; NAAC reports'],
            ['Campus Ops', 'Hostel, transport, inventory &amp; helpdesk'],
          ]
            .map(([t, d]) => moduleCard('✓', t, d))
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
      const exampleStrength = 2020;
      const exampleTotal = exampleStrength * ctx.perStudentSubscriptionRate;
      const monthlyPerStudent = ctx.perStudentSubscriptionRate / 12;
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
              <td>₹${ctx.perStudentSubscriptionRate.toLocaleString('en-IN')} × ${ctx.studentStrength.toLocaleString('en-IN')} students (approx.)</td>
              <td>${inr(subscriptionTotal)}</td>
            </tr>
            ${otherLines
              .map(
                (l) =>
                  `<tr><td>${l.label}</td><td>${l.amount === 0 ? 'Included in annual subscription' : 'Annual / One-time'}</td><td>${inr(l.amount)}</td></tr>`,
              )
              .join('')}
            <tr><th colspan="2">Total Annual Commercial Value</th><th>${inr(total)}</th></tr>
          </tbody>
        </table>

        <div class="card card-compact no-break" style="margin-top:10px;">
          <h3>Calculation</h3>
          <ul>
            <li><strong>${exampleStrength.toLocaleString('en-IN')} Students × ₹${ctx.perStudentSubscriptionRate.toLocaleString('en-IN')} = ${inr(exampleTotal)}</strong> per Academic Year</li>
            <li><strong>Average Cost per Student per Month:</strong> ₹${ctx.perStudentSubscriptionRate.toLocaleString('en-IN')} ÷ 12 = <strong>₹${monthlyPerStudent.toFixed(2)}</strong> per student per month</li>
            <li>The annual subscription will be <strong>recalculated each academic year</strong> based on the officially enrolled student strength.</li>
          </ul>
        </div>

        <div class="grid-2" style="margin-top:8px;">
          <div class="card card-compact"><h3>Annual Subscription Includes</h3><ul>
            <li>Unlimited ERP usage for authorized users</li>
            <li>Student &amp; Faculty mobile applications</li>
            <li>College website CMS &amp; public site</li>
            <li>Software maintenance, bug fixes &amp; security updates</li>
            <li>Technical support &amp; database maintenance</li>
            <li>Feature improvements &amp; user training / documentation</li>
            <li>Implementation, onboarding &amp; go-live support</li>
          </ul></div>
          <div class="card card-compact">
            <div class="small">Per-Student Rate</div>
            <div class="kpi kpi-sm">${inr(ctx.perStudentSubscriptionRate)}</div>
            <div class="small" style="margin-top:6px;">Estimated Students</div>
            <div class="kpi kpi-sm">${ctx.studentStrength.toLocaleString('en-IN')}</div>
            <div class="small" style="margin-top:6px;">Total Annual Subscription</div>
            <div class="kpi kpi-sm">${inr(subscriptionTotal)}</div>
          </div>
        </div>

        <h2 style="margin-top:10px;">Commercial Terms</h2>
        <div class="chip-row">
          ${['Annual subscription model', 'Billing per enrolled student / academic year', `Rate ₹${ctx.perStudentSubscriptionRate}/student`, 'Support included in active subscription', 'Feature enhancements included where applicable'].map(chip).join('')}
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
              ['Access', 'Office-bound', 'Mobile + web anywhere'],
              [
                'Public Website',
                'Vendor-dependent updates',
                'In-house CMS publishing',
              ],
              ['Leadership', 'Delayed visibility', 'Real-time Principal Desk'],
              [
                'Accreditation',
                'Scattered evidence',
                'NAAC/IQAC vault & trail',
              ],
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
