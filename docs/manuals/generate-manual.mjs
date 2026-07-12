/**
 * Generates docs/manuals/BCL-OneCampus-ERP-Enterprise-User-Manual.html
 * Run: node docs/manuals/generate-manual.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'BCL-OneCampus-ERP-Enterprise-User-Manual.html');

const META = {
  product: 'BCL OneCampus ERP',
  title: 'Enterprise User Manual & Administration Guide',
  tagline: 'Complete Campus Management System',
  version: '1.0.0',
  docVersion: 'DOC-2026.07',
  releaseDate: '12 July 2026',
  company: 'BaseCode Labs Pvt. Ltd.',
  website: 'https://basecodelabs.com',
  email: 'contact@basecodelabs.com',
  phone: '+91 95663 63655',
  licensingEmail: 'licensing@basecodelabs.com',
  copyright: '© 2026 BaseCode Labs Pvt. Ltd. All rights reserved.',
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shot(caption) {
  return `<figure class="shot">
  <div class="shot-frame">[Insert ${esc(caption)} Screenshot]</div>
  <figcaption>Figure — ${esc(caption)}. Replace this placeholder with a production screenshot.</figcaption>
</figure>`;
}

function fieldTable(rows) {
  return `<div class="table-wrap"><table class="fields">
<thead><tr><th>Field</th><th>Description</th><th>Mandatory</th><th>Example</th></tr></thead>
<tbody>
${rows
  .map(
    (r) =>
      `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`,
  )
  .join('\n')}
</tbody></table></div>`;
}

function steps(items) {
  return `<ol class="steps">${items.map((s, i) => `<li><strong>Step ${i + 1}.</strong> ${s}</li>`).join('')}</ol>`;
}

function flow(nodes) {
  return `<div class="flow" role="img" aria-label="Process flow">${nodes
    .map(
      (n, i) =>
        `<div class="flow-node">${esc(n)}</div>${i < nodes.length - 1 ? '<div class="flow-arrow" aria-hidden="true">↓</div>' : ''}`,
    )
    .join('')}</div>`;
}

function navPath(parts) {
  return `<div class="nav-path">${parts.map((p) => `<span>${esc(p)}</span>`).join('<span class="nav-sep">→</span>')}</div>`;
}

function moduleChapter(m) {
  const id = m.id;
  return `
<article class="chapter" id="${id}">
  <header class="chapter-head">
    <p class="chapter-kicker">Chapter</p>
    <h2>${esc(m.title)}</h2>
    ${m.subtitle ? `<p class="chapter-sub">${esc(m.subtitle)}</p>` : ''}
  </header>

  <section id="${id}-overview">
    <h3>Overview</h3>
    <p>${m.overview}</p>
    <div class="info-grid">
      <div><h4>Purpose</h4><p>${m.purpose}</p></div>
      <div><h4>Business use case</h4><p>${m.useCase}</p></div>
      <div><h4>Primary users</h4><p>${m.users}</p></div>
      <div><h4>Why it exists</h4><p>${m.why}</p></div>
    </div>
  </section>

  <section id="${id}-nav">
    <h3>Menu navigation</h3>
    ${navPath(m.nav)}
    <p class="note">${m.navNote || 'Access requires the appropriate role permission. Menu items may be hidden if your license or role does not include this module.'}</p>
  </section>

  <section id="${id}-screen">
    <h3>Screen overview</h3>
    ${m.screen}
    ${shot(m.shot || m.title + ' main screen')}
  </section>

  ${
    m.fields
      ? `<section id="${id}-fields"><h3>Field description</h3>${fieldTable(m.fields)}</section>`
      : ''
  }

  <section id="${id}-procedure">
    <h3>Step-by-step procedure</h3>
    ${m.procedureTitle ? `<h4>${esc(m.procedureTitle)}</h4>` : ''}
    ${steps(m.steps)}
  </section>

  ${m.flow ? `<section id="${id}-flow"><h3>Workflow diagram</h3>${flow(m.flow)}</section>` : ''}

  <section id="${id}-practices">
    <h3>Best practices</h3>
    <ul class="check">${m.practices.map((p) => `<li>${p}</li>`).join('')}</ul>
  </section>

  <section id="${id}-errors">
    <h3>Common errors</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Error / symptom</th><th>Likely cause</th><th>Resolution</th></tr></thead>
      <tbody>
      ${m.errors
        .map((e) => `<tr><td>${esc(e[0])}</td><td>${esc(e[1])}</td><td>${esc(e[2])}</td></tr>`)
        .join('')}
      </tbody>
    </table></div>
  </section>

  <section id="${id}-faq">
    <h3>Frequently asked questions</h3>
    <dl class="faq">
      ${m.faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${f.a}</dd>`).join('')}
    </dl>
  </section>

  <section id="${id}-notes">
    <h3>Administrator notes</h3>
    <div class="callout tip"><strong>Tip.</strong> ${m.notes}</div>
  </section>
</article>`;
}

const MODULES = [
  {
    id: 'ch-dashboard',
    title: 'Dashboard & Analytics',
    subtitle: 'Operations command center for institutional visibility',
    overview:
      'The Admin Dashboard is the operational home page of BCL OneCampus ERP. It consolidates student, academic, fee, attendance, and licensing signals so leadership and administrators can act without navigating every module first.',
    purpose:
      'Provide at-a-glance KPIs, alerts, quick actions, and OneCampus AI assistance for campus operations.',
    useCase:
      'A registrar opens the day with pending admissions, fee defaulters, and attendance anomalies; a principal reviews institutional health from Principal Desk.',
    users: 'College Admin, Academic Admin, Principal, Vice Principal, ERP Administrator',
    why: 'Enterprise campuses need a single pane of glass for NEP-era multi-shift, multi-programme operations.',
    nav: ['Admin portal', 'Dashboard', '/admin'],
    screen:
      '<p>The dashboard typically includes KPI cards, alert banners (license, payments), quick links, recent activity, and the OneCampus AI Assistant (Ctrl+K command palette). Use <strong>Analytics</strong> for deeper charts where enabled.</p><ul><li><strong>KPI cards</strong> — students, admissions, fees, attendance</li><li><strong>Alerts</strong> — license expiry, payment failures, pending approvals</li><li><strong>Quick actions</strong> — add student, collect fees, open reports</li><li><strong>Command palette</strong> — search menus, students, and ask OneCampus AI</li></ul>',
    shot: 'Admin Dashboard',
    fields: [
      ['Date range filter', 'Scopes KPI widgets to a period', 'No', 'Current academic session'],
      ['Campus / Shift filter', 'Limits data to a campus or shift', 'No', 'Morning Shift'],
      ['Search (Ctrl+K)', 'Global search and AI assistant', 'No', 'Show fee defaulters'],
    ],
    procedureTitle: 'Starting your day on the dashboard',
    steps: [
      'Sign in with an administrator account and land on <em>Dashboard</em>.',
      'Review license and payment alert banners; resolve critical items first.',
      'Open pending queues (admissions, profile verification, fee collection) from quick links.',
      'Use Ctrl+K to search a student, report, or ask OneCampus AI a natural-language question.',
      'Drill into Analytics or Reports for board-ready summaries.',
    ],
    flow: ['Login', 'Dashboard KPIs', 'Alert triage', 'Module deep-dive', 'Reports / AI'],
    practices: [
      'Treat dashboard alerts as an operations queue, not optional notices.',
      'Do not share admin sessions; use named users for auditability.',
      'Validate KPI filters against the active academic session before sharing numbers with leadership.',
    ],
    errors: [
      [
        'Blank KPIs',
        'Wrong academic session or missing permissions',
        'Switch session in settings; confirm role permissions',
      ],
      [
        'AI returns no answer',
        'Knowledge base not synced',
        'Sync catalog from Administration → Knowledge Base',
      ],
    ],
    faq: [
      {
        q: 'Who can see Analytics?',
        a: 'Users with analytics/report permissions. Some analytics tiles may show as Coming soon depending on edition.',
      },
      {
        q: 'Can I customize the dashboard layout?',
        a: 'Institution branding and theme are managed in Theme Studio; KPI visibility follows role permissions.',
      },
    ],
    notes: 'Export key daily numbers via Reports Hub for archival minutes of meetings.',
  },
  {
    id: 'ch-institution',
    title: 'Institution Setup & Organization',
    subtitle: 'Legal entity, campuses, branding, and infrastructure masters',
    overview:
      'Institution Setup establishes the organizational identity of the college inside OneCampus: display name, campuses, branding, academic structure foundations, and physical infrastructure (buildings, rooms, labs).',
    purpose:
      'Configure the tenant so every document, ID card, fee receipt, and portal reflects the correct institution.',
    useCase:
      'A new college goes live: create organization profile, upload logo, define campuses/shifts, map buildings and rooms.',
    users: 'Institution Admin, ERP Administrator, College Admin',
    why: 'All downstream modules (fees, ID cards, certificates, NAAC evidence) inherit institution masters.',
    nav: ['Administration / Settings', 'Organization', '/admin/organization'],
    screen:
      '<p>Organization settings cover legal name, address, contact, affiliation lines, logo, and theme colors. Infrastructure submenu manages Buildings → Floors → Rooms / Labs / Shared halls and room calendars.</p>',
    shot: 'Organization settings',
    fields: [
      [
        'Institution display name',
        'Name shown on portals and documents',
        'Yes',
        'Don Bosco College, Tura',
      ],
      ['Short name', 'Compact label for cards and headers', 'Yes', 'DBC Tura'],
      ['Primary / accent color', 'Brand colors for UI and print', 'Yes', '#001B44 / #8B1538'],
      ['Logo', 'Institution emblem (PNG/SVG recommended)', 'Recommended', 'college-logo.png'],
      [
        'Affiliation line',
        'Printed on ID cards and certificates',
        'Recommended',
        'Affiliated to NEHU',
      ],
      ['Campus name', 'Multi-campus label if applicable', 'No', 'Main Campus'],
    ],
    procedureTitle: 'Configuring institution identity',
    steps: [
      'Open <em>Settings → Organization</em> (or Theme Studio for branding).',
      'Enter legal and display names, address, phone, email, and website.',
      'Upload logo and set primary/accent colors; preview login and student portal.',
      'Define campuses if multi-campus; configure shifts under Academics → Shift Management.',
      'Under Infrastructure, create buildings, floors, and rooms used by timetable and inventory.',
      'Save and verify appearance on login, ID card designer, and fee receipts.',
    ],
    flow: [
      'Organization profile',
      'Branding & theme',
      'Campuses & shifts',
      'Infrastructure masters',
      'Verify on portals',
    ],
    practices: [
      'Keep affiliation and accreditation text accurate for NAAC and printed credentials.',
      'Use high-resolution logos with transparent backgrounds for ID cards.',
      'Never change institution short codes mid-session without impact analysis on roll numbers and receipts.',
    ],
    errors: [
      [
        'Logo missing on login',
        'Asset URL blocked or 404',
        'Re-upload via Theme Studio; confirm public URL',
      ],
      [
        'Wrong colors on ID cards',
        'Template uses hardcoded colors',
        'Update template brand colors or Theme Studio',
      ],
    ],
    faq: [
      {
        q: 'Can one tenant run multiple campuses?',
        a: 'Yes. Use campus masters and filters; confirm license covers multi-campus if required.',
      },
    ],
    notes:
      'After branding changes, regenerate sample ID cards and certificates to validate print fidelity.',
  },
  {
    id: 'ch-users',
    title: 'User Management, Roles & Permissions',
    subtitle: 'Identity, access control, and portal routing',
    overview:
      'User Management controls who can sign in, which portal they receive (Admin, Staff, Student, Principal Desk, Library Desk, Applicant), and which modules they may access via roles and fine-grained permissions.',
    purpose:
      'Enforce least-privilege access across college, academic, finance, and library workspaces.',
    useCase:
      'Create a faculty user linked to a staff record; assign Faculty workspace template; grant marks-entry permission for one department.',
    users: 'ERP Administrator, College Admin, Institution Admin',
    why: 'Auditability and data protection require named accounts and role-based access, not shared passwords.',
    nav: ['Administration', 'Portal Users / Roles & Permissions', '/admin/administration'],
    screen:
      '<p>Key screens: Portal Users, Roles & Permissions, User Permissions, User Activation, Security & Sessions, Audit Logs. Workspace templates (Faculty, HOD, Accounts, Library, Front Office, Examination Cell, Principal) accelerate role setup.</p>',
    shot: 'Roles & Permissions',
    fields: [
      ['Username / email', 'Login identifier', 'Yes', 'faculty.education@college.edu'],
      ['Role', 'Primary portal role', 'Yes', 'faculty'],
      [
        'Linked staff / student',
        'Binds portal to ERP person record',
        'Recommended',
        'Staff EMP-015',
      ],
      ['Status', 'Active / inactive', 'Yes', 'Active'],
      ['Permission overrides', 'Extra allow/deny beyond role', 'No', 'fees.collect'],
    ],
    procedureTitle: 'Creating a portal user',
    steps: [
      'Open <em>Administration → Portal Users</em> and choose Add User.',
      'Enter identity details and select the primary role (e.g., faculty, accountant, librarian).',
      'Link the user to the corresponding Staff or Student master record.',
      'Apply a workspace template or customize permissions in Roles & Permissions.',
      'Activate the account and share temporary credentials via secure channel.',
      'Ask the user to change password on first login; verify portal landing page.',
    ],
    flow: [
      'Create user',
      'Assign role',
      'Link person record',
      'Set permissions',
      'Activate',
      'First login',
    ],
    practices: [
      'Disable accounts on resignation the same day HR closes employment.',
      'Prefer role templates over one-off permission sprawl.',
      'Review Security & Sessions regularly for concurrent or suspicious logins.',
    ],
    errors: [
      [
        'User lands on Access Denied',
        'Missing portal role mapping',
        'Assign correct role in portal-access set',
      ],
      [
        'Faculty cannot mark attendance',
        'Permission not in role',
        'Grant attendance entry permission',
      ],
    ],
    faq: [
      {
        q: 'Difference between staff and faculty roles?',
        a: 'Both use the Staff portal; faculty typically includes teaching, marks, and LMS permissions.',
      },
      {
        q: 'What is platform-admin?',
        a: 'BaseCode Labs platform operators managing licenses across tenants — not a college role.',
      },
    ],
    notes: 'All sensitive actions are written to Audit Logs — retain per institutional policy.',
  },
  {
    id: 'ch-academic',
    title: 'Academic Management',
    subtitle: 'Programmes, curriculum engine, courses, subjects, sessions, and shifts',
    overview:
      'Academic Management is the structural backbone for NEP / FYUGP delivery: programmes, curriculum versions, course/subject masters, subject mapping, academic sessions (years/semesters), and shift configuration (Morning/Evening).',
    purpose:
      'Define what is taught, when, and under which programme rules so attendance, timetable, fees, and exams stay consistent.',
    useCase:
      'Launch FYUGP BA with Major/Minor/MDC/AEC/SEC/VAC baskets; activate Semester III for 2026–27 Morning shift.',
    users: 'Academic Admin, HOD, Shift Admin, College Admin',
    why: 'Without clean academic masters, promotion, exam fees, and subject registration fail.',
    nav: ['Academics', 'Programmes / Curriculum / Sessions / Shifts', '/admin/programs'],
    screen:
      '<p>Sub-modules include Programmes, Curriculum (Academic Engine), Course Master, Subject Sections, Subject Mapping, Academic Sessions (lifecycle), and Shift Management. Use filters by programme, semester, and shift on list screens; Export for NAAC evidence.</p>',
    shot: 'Curriculum / Academic Engine',
    fields: [
      ['Programme code / name', 'Official programme identity', 'Yes', 'BA-ECO / B.A. Economics'],
      ['Curriculum version', 'Rule set for a cohort', 'Yes', 'FYUGP-2024'],
      ['Course / subject code', 'Paper identity', 'Yes', 'EDN-DSC-301'],
      ['Category', 'Major, Minor, MDC, AEC, SEC, VAC, VTC…', 'Yes', 'MDC'],
      ['Credits', 'Credit load', 'Yes', '4'],
      ['Academic session', 'Year / semester window', 'Yes', '2026–27 Odd'],
      ['Shift', 'Delivery window', 'Yes', 'Morning'],
    ],
    procedureTitle: 'Activating a semester for teaching',
    steps: [
      'Confirm programme and curriculum version for the cohort under Curriculum.',
      'Open Academic Sessions and create/activate the target session and semester.',
      'Ensure subjects are mapped for the semester (Subject Mapping / Course Master).',
      'Configure or verify Shift Management for Morning/Evening offerings.',
      'Publish subject sections and teaching allocations before timetable generation.',
      'Notify faculty via Communication and open student subject registration if required.',
    ],
    flow: [
      'Programme master',
      'Curriculum version',
      'Subject mapping',
      'Session activation',
      'Shift offerings',
      'Timetable / registration',
    ],
    practices: [
      'Never edit a published curriculum in place — create a new version for the next cohort.',
      'Lock subject codes once examination fees or university submission has started.',
      'Align shift configuration with fee plans and attendance periods.',
    ],
    errors: [
      [
        'Students cannot register subjects',
        'Session inactive or mapping missing',
        'Activate session; complete subject mapping',
      ],
      [
        'Wrong paper on hall ticket',
        'Incorrect subject mapping',
        'Correct mapping and regenerate cards',
      ],
    ],
    faq: [
      {
        q: 'What is the Academic Engine?',
        a: 'Curriculum management for structured FYUGP baskets and versioned programme rules.',
      },
      {
        q: 'Can two shifts share the same subject code?',
        a: 'Yes via offerings/sections; keep teaching allocation distinct per shift.',
      },
    ],
    notes: 'Export curriculum and session snapshots before university inspection visits.',
  },
  {
    id: 'ch-admission',
    title: 'Admission Management',
    subtitle: 'Intakes, applications, merit, fees, and admitted students',
    overview:
      'Admission Management covers the full applicant journey: intakes and cycles, online applications, document and payment verification, merit/selection, admission fee verification, and conversion to admitted students in the Student Directory.',
    purpose:
      'Run transparent, auditable admissions aligned to published cycles and fee structures.',
    useCase:
      'Open UG admission cycle 2026; verify documents and fees; publish merit; confirm admitted list.',
    users: 'Admission Admin, Front Office, Accounts, Applicants (portal)',
    why: 'Admissions generate the student master; errors cascade into fees, roll numbers, and exams.',
    nav: ['Student Lifecycle', 'Admissions', '/admin/admissions'],
    screen:
      '<p>Control center plus Applications, Documents, Payments, Admission Fees, Merit & Selection, Admitted Students, Intakes, Cycles & Settings, Analytics, Archive. Applicant self-service lives under Admissions Portal.</p>',
    shot: 'Admissions Control Center',
    fields: [
      ['Intake / cycle', 'Admission window', 'Yes', 'UG-2026 Round 1'],
      ['Applicant name', 'As per ID proof', 'Yes', 'Rikchakam Ch Marak'],
      ['Programme applied', 'Chosen programme', 'Yes', 'B.A. Economics'],
      ['Application status', 'Workflow state', 'System', 'Under verification'],
      ['Documents', 'Uploaded proofs', 'Yes', 'Marksheet, photo, ID'],
      ['Application fee payment', 'Gateway or manual', 'Yes', 'Paid – UPI'],
    ],
    procedureTitle: 'Processing an application to admission',
    steps: [
      'Ensure Intake and Cycle are open under Cycles & Settings with fee structure linked.',
      'Applicant submits form in Admissions Portal; staff open Applications queue.',
      'Verify documents; mark deficiencies with remarks for resubmission.',
      'Verify application/admission fee payments.',
      'Run Merit & Selection per published rules; generate selection lists.',
      'Confirm admitted students; complete roll number / RFID steps as per policy.',
      'Archive closed cycles; retain analytics for reporting.',
    ],
    flow: [
      'Intake open',
      'Application',
      'Document verification',
      'Fee payment',
      'Merit & selection',
      'Admission confirmation',
      'Student ID / ERP record',
    ],
    practices: [
      'Publish cycle dates and fee heads before accepting applications.',
      'Reject duplicate applications with the same ID proof.',
      'Keep merit criteria versioned for grievance redressal.',
    ],
    errors: [
      [
        'Payment verified but status stuck',
        'Webhook delay',
        'Manual verify in Payments; refresh status',
      ],
      [
        'Applicant cannot upload documents',
        'File type/size limit',
        'Convert to PDF under size limit',
      ],
    ],
    faq: [
      {
        q: 'Where do applicants log in?',
        a: 'Admissions Portal (/admissions-portal), separate from student portal until admission is confirmed.',
      },
    ],
    notes: 'Use Admission Analytics for seat fill and demographic reports for governance.',
  },
  {
    id: 'ch-students',
    title: 'Student Management',
    subtitle: 'Directory, profiles, promotion, RFID/ABC ID, and verification',
    overview:
      'Student Management maintains the lifelong student record: directory, profile verification workflows, subject registration, semester imports, promotion, certificates linkage, attendance/fees shortcuts, and RFID / ABC ID mapping.',
    purpose:
      'Keep a single authoritative student master for academics, finance, exams, and identity cards.',
    useCase:
      'Promote Semester II to III; verify Class XII documents; map RFID for campus access and library.',
    users: 'Academic Admin, Registrar, Front Office, Examination Cell',
    why: 'Duplicate or incomplete profiles break attendance, fees, and NAAC student data.',
    nav: ['Student Lifecycle', 'Students', '/admin/students'],
    screen:
      '<p>Directory with search/filters/export; Add Student; Subject Registration; Semester imports; Profile Verification suite (pending, policy, Class XII, completion, history, documents); RFID/ABC ID; Promotion; Bulk Import/Export; Audit Logs.</p>',
    shot: 'Student Directory',
    fields: [
      ['Registration / Roll number', 'Unique academic identity', 'Yes', 'REG2026048'],
      ['Full name', 'Official name', 'Yes', 'Rikchakam Ch Marak'],
      ['Programme / Department', 'Academic placement', 'Yes', 'B.A. Economics / Education'],
      ['Shift', 'Morning / Evening', 'Yes', 'Morning'],
      ['Photo', 'ID and portal photo', 'Recommended', 'passport photo'],
      ['RFID / ABC ID', 'Physical / national ID mapping', 'As required', 'RFID-00001234'],
      [
        'Holder address',
        'Residential address for ID card back',
        'Recommended',
        'Village, District, PIN',
      ],
    ],
    procedureTitle: 'Creating a student record',
    steps: [
      'Prefer admission conversion when available; otherwise open Add Student.',
      'Enter identity, programme, session, shift, and contact details.',
      'Upload photo and required documents; set profile verification policy status.',
      'Assign roll/registration numbers per Roll Number Settings.',
      'Map RFID/ABC ID if campus access or library requires it.',
      'Verify the student can log in to the Student Portal / mobile app.',
    ],
    flow: [
      'Admission / Add Student',
      'Profile completion',
      'Verification',
      'Subject registration',
      'Promotion',
      'Exit / alumni',
    ],
    practices: [
      'Search before create to avoid duplicate roll numbers.',
      'Require photo before ID card production.',
      'Run Profile Completion Dashboard weekly during admission season.',
    ],
    errors: [
      [
        'Duplicate roll number',
        'Manual collision',
        'Use generation service; merge duplicates carefully',
      ],
      [
        'Promotion blocked',
        'Fees or attendance shortage',
        'Clear dues or apply approved exception',
      ],
    ],
    faq: [
      {
        q: 'What is profile verification?',
        a: 'Workflow ensuring personal, guardian, bank, Class XII, and document data meet institutional policy before locking.',
      },
    ],
    notes: 'Bulk Import supports semester onboarding; always dry-run on a small CSV first.',
  },
  {
    id: 'ch-staff',
    title: 'Staff Management',
    subtitle: 'Staff directory, teaching assignments, and portal users',
    overview:
      'Staff Management maintains teaching and non-teaching employee masters, bulk import/update, teaching assignments, portal user linkage, reports, roles, and audit history.',
    purpose: 'Single staff master for HR, timetable, attendance, payroll, and ID cards.',
    useCase: 'Onboard a new Assistant Professor; assign subjects; enable Staff Portal login.',
    users: 'HR, Academic Admin, College Admin',
    why: 'Teaching allocation and payroll depend on accurate staff identity and department.',
    nav: ['Staff & HR', 'Staff', '/admin/staff'],
    screen:
      '<p>Directory, Add Staff, Bulk Import/Update, Teaching Assignments, Portal Users, Reports, Roles, Audit Logs.</p>',
    shot: 'Staff Directory',
    fields: [
      ['Employee ID', 'Institution staff code', 'Yes', 'DBCST2024015'],
      ['Name', 'Official name', 'Yes', "Fr. Albert D'Souza"],
      ['Designation / Department', 'Positioning', 'Yes', 'Assistant Professor / Education'],
      ['Employment type', 'Teaching / non-teaching', 'Yes', 'Teaching'],
      ['Joining date', 'Date of joining', 'Yes', '2024-01-15'],
    ],
    procedureTitle: 'Onboarding teaching staff',
    steps: [
      'Create staff record with employee ID, designation, and department.',
      'Complete employment details used by HR and ID cards.',
      'Create linked portal user with faculty/staff role.',
      'Assign teaching load under Teaching Assignments / Timetable allocation.',
      'Issue staff ID card from Identity module when ready.',
    ],
    flow: ['Staff master', 'Portal user', 'Teaching assignment', 'Attendance & payroll', 'ID card'],
    practices: [
      'Keep employee IDs immutable after first payslip.',
      'Sync designation changes with HR Salary Structures.',
    ],
    errors: [
      [
        'Staff missing in timetable pickers',
        'Inactive or wrong department',
        'Activate record; fix department',
      ],
    ],
    faq: [
      {
        q: 'Is Staff the same as HR?',
        a: 'Staff is the operational master; HR adds leave, payroll, recruitment, and compliance processes.',
      },
    ],
    notes: 'Use Bulk Update for department-wide designation changes with audit review.',
  },
  {
    id: 'ch-attendance',
    title: 'Attendance Management',
    subtitle: 'Student attendance and staff biometric attendance',
    overview:
      'Attendance covers student class attendance (academics) and staff attendance with biometric device integration, live dashboards, daily/monthly registers, and audit.',
    purpose: 'Capture presence for academic eligibility, payroll, and compliance reporting.',
    useCase:
      'Faculty marks period attendance; HR pulls biometric logs and processes monthly register.',
    users: 'Faculty, Academic Admin, HR, Shift Attendance Manager',
    why: 'Defaulters, exam eligibility, and salary deductions rely on trusted attendance.',
    nav: [
      'Academics / Staff',
      'Student Attendance or Staff Attendance',
      '/admin/academics/attendance',
    ],
    screen:
      '<p>Student attendance: class/subject filters, mark sheet, bulk save, defaulter views. Staff attendance: Live, Pull Logs, Process, Daily/Monthly Register, Biometric Devices, Settings, Audit.</p>',
    shot: 'Student Attendance marking',
    fields: [
      ['Date / period', 'Session being marked', 'Yes', '11 Jul 2026 / Period 2'],
      ['Subject / class', 'Teaching context', 'Yes', 'EDN-DSC-301 Sec A'],
      ['Status', 'Present / Absent / Late / On duty', 'Yes', 'Present'],
      ['Device (staff)', 'Biometric source', 'If used', 'Main Gate Device'],
    ],
    procedureTitle: 'Marking student attendance',
    steps: [
      'Open Student Attendance and select date, shift, subject/section.',
      'Load the student list; mark absentees (or present-all then adjust).',
      'Save; correct within institutional edit window if needed.',
      'Review defaulters before examinations.',
    ],
    flow: ['Select class', 'Mark attendance', 'Save', 'Defaulter review', 'Eligibility / reports'],
    practices: [
      'Mark within the same teaching day.',
      'Reconcile biometric staff logs before payroll lock.',
    ],
    errors: [
      [
        'Students missing from list',
        'Subject registration incomplete',
        'Complete registration / section mapping',
      ],
      ['Biometric pull empty', 'Device offline', 'Check device settings and network'],
    ],
    faq: [
      {
        q: 'Can students see their attendance?',
        a: 'Yes via Student Portal and mobile My Academics → Attendance.',
      },
    ],
    notes: 'Export Monthly Attendance for NAAC and university inspections.',
  },
  {
    id: 'ch-timetable',
    title: 'Timetable Management',
    subtitle: 'Plans, allocation, generation, conflicts, and publish',
    overview:
      'The Timetable Engine manages plans, subject groups, teaching allocation, bulk import/export, validation, generation, conflict resolution, draft review, publish, and reports.',
    purpose: 'Produce conflict-free weekly schedules for students and faculty across shifts.',
    useCase:
      'Generate Odd Semester 2026 Morning timetable; resolve room clashes; publish to portals.',
    users: 'Academic Admin, Shift Academic Coordinator, HOD',
    why: 'Published timetables drive attendance periods, room booking, and faculty load.',
    nav: ['Academic Operations', 'Timetable', '/admin/academics/timetable'],
    screen:
      '<p>Dashboard, Plans, Subject Groups, Teaching Allocation, Import/Export, Validation Center, Generation Engine, Conflict Resolution, Draft Review, Publish, Reports, Settings.</p>',
    shot: 'Timetable Generation Engine',
    fields: [
      ['Timetable plan', 'Named schedule version', 'Yes', 'FYUGP Odd 2026 Morning'],
      ['Teaching allocation', 'Faculty–subject–section link', 'Yes', 'Fr. Albert → EDN-301'],
      ['Room', 'Venue', 'Yes', 'LH-12'],
      ['Slot', 'Day and period', 'Yes', 'Mon P2'],
    ],
    procedureTitle: 'Publishing a timetable',
    steps: [
      'Create a Timetable Plan for the session and shift.',
      'Complete Teaching Allocation and room availability.',
      'Run Validation Center; fix missing allocations.',
      'Generate draft; resolve conflicts (faculty, room, batch).',
      'Review draft with HODs; Publish to student/staff portals and mobile.',
    ],
    flow: ['Plan', 'Allocation', 'Validate', 'Generate', 'Resolve conflicts', 'Publish'],
    practices: [
      'Keep a draft plan until HODs sign off.',
      'Do not edit published slots without notifying Communication Center.',
    ],
    errors: [
      ['Faculty double-booked', 'Conflict unresolved', 'Use Conflict Resolution before publish'],
    ],
    faq: [
      {
        q: 'Do students get push notifications on publish?',
        a: 'Configure Communication / Firebase; optional campaign after publish.',
      },
    ],
    notes: 'Archive published plans each semester for audit.',
  },
  {
    id: 'ch-exam',
    title: 'Examination Management',
    subtitle: 'Internal assessment, admit cards, marks, and university submission',
    overview:
      'Examinations manage IA exams, IA timetable, admit cards (when enabled), mark entry, defaulters, analytics, reports, NEHU/university submission, plus a dedicated Semester Exam Fees module.',
    purpose: 'Conduct fair internal assessment and collect/submit marks with fee compliance.',
    useCase:
      'Schedule IA-1; generate admit cards; enter marks; submit university files; collect semester exam fees including back papers.',
    users: 'Examination Cell, Faculty, Academic Admin, Accounts',
    why: 'Results, hall tickets, and university compliance require controlled exam workflows.',
    nav: ['Examination', 'Examinations / Semester Exam Fees', '/admin/academics/examinations'],
    screen:
      '<p>IA Dashboard, exams, timetable, admit cards, mark entry, defaulters, analytics, university submission, settings. Exam Fees: fee setup, sessions, student application, back papers, gateway/manual collection, verification, receipts.</p>',
    shot: 'IA Mark Entry',
    fields: [
      ['Exam name', 'IA / test identity', 'Yes', 'IA-1 Odd 2026'],
      ['Max marks', 'Paper maximum', 'Yes', '20'],
      ['Marks obtained', 'Student score', 'Yes', '16'],
      ['Exam fee session', 'Fee window', 'Yes', 'NEHU Sem Exam Dec 2026'],
      ['Back paper selection', 'Arrear papers', 'If applicable', 'EDN-201'],
    ],
    procedureTitle: 'Running an IA cycle',
    steps: [
      'Create IA exam and timetable; notify faculty and students.',
      'Generate admit cards if feature-enabled and eligibility passed.',
      'Open Mark Entry for faculty/exam cell; lock after deadline.',
      'Review defaulters and analytics; publish results to student portal.',
      'Prepare university submission package as configured for NEHU.',
    ],
    flow: [
      'Exam setup',
      'Timetable',
      'Eligibility & fees',
      'Admit card',
      'Conduct',
      'Mark entry',
      'Results / submission',
    ],
    practices: [
      'Freeze subject mapping before admit card generation.',
      'Reconcile exam fee payments before hall ticket release.',
    ],
    errors: [
      [
        'Admit card missing subject',
        'Registration mismatch',
        'Fix subject registration and regenerate',
      ],
      [
        'Payment success but application unpaid',
        'Gateway callback delay',
        'Verify in Fee Verification',
      ],
    ],
    faq: [
      {
        q: 'Where do students pay semester exam fees?',
        a: 'Student Portal / mobile → Semester Exam Fees, or Accounts Manual Fee Collection.',
      },
    ],
    notes: 'Keep university submission exports immutable after dispatch.',
  },
  {
    id: 'ch-qbank',
    title: 'Question Paper Repository',
    subtitle: 'Upload, approval, faculty workspace, and student access',
    overview:
      'Question Paper Repository (Question Bank) stores moderated question papers with upload wizard, faculty workspace, approval workflow, student access controls, analytics, and reports.',
    purpose: 'Centralize quality-assured papers for teaching and assessment preparation.',
    useCase: 'Faculty uploads IA set; HOD verifies; students access past papers when published.',
    users: 'Faculty, HOD, Examination Cell, Academic Admin',
    why: 'Avoids unmanaged shared drives and preserves version history for audits.',
    nav: ['Academic Operations', 'Question Paper Repository', '/admin/academics/question-bank'],
    screen:
      '<p>Dashboard, Repository grid, Upload, Faculty Workspace, Approval Workflow, Student Access, Reports, Settings. Filters include course, uploaded by, verified by.</p>',
    shot: 'Question Paper Repository grid',
    fields: [
      ['Title', 'Paper title', 'Yes', 'IA-1 DSC Core Set A'],
      ['Course / subject', 'Linked paper', 'Yes', 'EDN-DSC-301'],
      ['File', 'PDF upload', 'Yes', 'ia1-set-a.pdf'],
      ['Visibility', 'Faculty only / students', 'Yes', 'Students after approval'],
    ],
    procedureTitle: 'Uploading and approving a paper',
    steps: [
      'Open Upload wizard; select course and metadata.',
      'Upload PDF; set verified-by if required by policy.',
      'Submit to Approval Workflow; HOD/exam cell approves.',
      'Publish to Student Access as per schedule.',
    ],
    flow: ['Upload', 'Metadata', 'Approval', 'Publish', 'Student access'],
    practices: [
      'Use clear naming: Programme_Semester_Paper_Set_Date.',
      'Revoke share links when papers are superseded.',
    ],
    errors: [
      [
        'Student cannot see paper',
        'Not approved or visibility off',
        'Approve and enable student access',
      ],
    ],
    faq: [
      {
        q: 'Is this the same as Library Question Papers?',
        a: 'Related but separate: Repository is academic workflow; Library may host digital archives.',
      },
    ],
    notes: 'Track Uploaded By / Verified By for NAAC documentation.',
  },
  {
    id: 'ch-fees',
    title: 'Fee Management',
    subtitle: 'Structures, demands, collection, scholarships, and defaulters',
    overview:
      'Fee Management handles fee structures, monthly plans, demand generation, collection center, finance setup, external payments, scholarships & concessions, student ledgers, defaulter intelligence, day closing, cash register, and renewal.',
    purpose: 'Collect institutional fees accurately with full ledger and cashier controls.',
    useCase:
      'Generate semester fee demand; collect via gateway/cash; apply scholarship; close day cash register.',
    users: 'Accountant, Accounts Staff, Front Office (limited), College Admin',
    why: 'Fee integrity underpins admission confirmation, exam eligibility, and financial statements.',
    nav: ['Fee Management', '/admin/fees'],
    screen:
      '<p>Fee Dashboard, Structure, Monthly Plans, Demand Generator, Collection Center, Finance Setup, External Payment Entry, Scholarships, Ledger Explorer, Defaulters, Reports, Settings, Fee Heads, Cycles, Admission Fee Structure, Day Closing, Cash Register, Renewal Center.</p>',
    shot: 'Fee Collection Center',
    fields: [
      ['Fee head', 'Charge component', 'Yes', 'Tuition'],
      ['Amount', 'Payable amount', 'Yes', '15000'],
      ['Demand period', 'Billing window', 'Yes', 'Odd Sem 2026'],
      ['Concession / scholarship', 'Waiver applied', 'No', 'Merit 25%'],
      ['Payment mode', 'Cash/UPI/Gateway/Bank', 'Yes', 'UPI'],
      ['Receipt number', 'System receipt', 'System', 'FEE-2026-00421'],
    ],
    procedureTitle: 'Collecting a student fee',
    steps: [
      'Confirm fee structure and demands are published for the session.',
      'Open Collection Center; search student by roll/registration.',
      'Select outstanding demands; apply approved concessions if any.',
      'Accept payment (gateway or manual); print/download receipt.',
      'At day end, run Day Closing / Cash Register reconciliation.',
    ],
    flow: [
      'Fee structure',
      'Demand generation',
      'Student notification',
      'Collection',
      'Receipt',
      'Day closing',
      'Reports / GL',
    ],
    practices: [
      'Never edit posted receipts — use reversal/adjustment per policy.',
      'Verify fee structure before publishing to student app Pay now.',
      'Reconcile gateway settlements daily.',
    ],
    errors: [
      ['Double demand', 'Demand generated twice', 'Cancel duplicate demand; audit ledger'],
      [
        'Gateway paid, ledger unpaid',
        'Callback failure',
        'External Payment Entry / verification tools',
      ],
    ],
    faq: [
      {
        q: 'How do scholarships work?',
        a: 'Configure in Scholarships & Concessions and apply to eligible student demands before collection.',
      },
    ],
    notes: 'Map fee heads to GL accounts under Finance for statutory reports.',
  },
  {
    id: 'ch-accounts',
    title: 'Finance & Accounts',
    subtitle: 'Chart of accounts, vouchers, books, assets, and audit trail',
    overview:
      'Finance & Accounts provides double-entry style campus accounting: chart of accounts, vouchers, cash/bank books, general ledger, financial years, fee GL mappings, vendors, expenses, budgets, fixed assets, bank reconciliation, reports, and audit trail.',
    purpose: 'Produce reliable financial books integrated with fee collections.',
    useCase: 'Post fee receipts to GL; reconcile bank; generate financial reports for auditors.',
    users: 'Accountant, College Admin',
    why: 'Institutions need auditable books beyond fee registers.',
    nav: ['Finance & Accounts', '/admin/accounts'],
    screen:
      '<p>Accounts Dashboard and submenus for COA, vouchers, cash/bank book, GL, FY, fee mappings, vendors, expenses, budgets, fixed assets, BRS, reports, audit trail.</p>',
    shot: 'Accounts Dashboard',
    fields: [
      ['Account code', 'GL account', 'Yes', '1001-Cash'],
      ['Voucher type', 'Payment/Receipt/Journal', 'Yes', 'Receipt'],
      ['Financial year', 'Books year', 'Yes', 'FY 2026-27'],
      ['Narration', 'Description', 'Yes', 'Tuition collection 11 Jul'],
    ],
    procedureTitle: 'Closing a financial day',
    steps: [
      'Ensure fee day closing is complete.',
      'Post or review automatic fee GL mappings.',
      'Reconcile cash and bank books.',
      'Lock period if policy requires; export reports.',
    ],
    flow: ['Transactions', 'Vouchers', 'Books', 'Reconciliation', 'Reports', 'Audit'],
    practices: [
      'Separate duties: collector vs accountant where staffing allows.',
      'Never delete posted vouchers — reverse.',
    ],
    errors: [['Imbalanced voucher', 'Debit ≠ credit', 'Correct lines before save']],
    faq: [
      {
        q: 'Relation to Fee Management?',
        a: 'Fees operationally collect money; Accounts books it via mappings and vouchers.',
      },
    ],
    notes: 'Retain Audit Trail exports with annual financial statements.',
  },
  {
    id: 'ch-comms',
    title: 'Communication Center',
    subtitle: 'Notifications, campaigns, email, SMS, WhatsApp, and push',
    overview:
      'Communication Center composes multi-channel messages: in-app notifications, campaigns, templates, audience builder, analytics, and settings that connect email, SMS, WhatsApp, and Firebase push for mobile.',
    purpose: 'Reach students, staff, and applicants with audited, templated communications.',
    useCase: 'Send fee due reminder campaign to Morning shift Sem III via push + SMS.',
    users: 'College Admin, Front Office, Academic Admin',
    why: 'Fragmented messaging causes missed deadlines and compliance risk.',
    nav: ['Communication', '/admin/communication'],
    screen:
      '<p>Notifications inbox management, Compose, Campaigns, Templates, Audience Builder, Analytics, Settings (provider keys, Firebase, email SMTP).</p>',
    shot: 'Compose Campaign',
    fields: [
      ['Channel', 'Push / Email / SMS / WhatsApp / In-app', 'Yes', 'Push + In-app'],
      ['Audience', 'Role, programme, shift filters', 'Yes', 'Students · Sem III · Morning'],
      ['Template', 'Approved message body', 'Recommended', 'FEE_DUE_REMINDER'],
      ['Schedule', 'Send now / later', 'No', 'Tomorrow 09:00'],
    ],
    procedureTitle: 'Sending a campaign',
    steps: [
      'Create or select an approved Template.',
      'Build Audience with precise filters; preview count.',
      'Compose message; attach files if channel supports.',
      'Send test to admin device; then schedule or send.',
      'Monitor Analytics for delivery/open failures.',
    ],
    flow: ['Template', 'Audience', 'Compose', 'Test', 'Send', 'Analytics'],
    practices: [
      'Respect quiet hours for SMS/WhatsApp.',
      'Never send passwords in clear text.',
      'Keep Firebase and SMTP credentials in Settings only — not in templates.',
    ],
    errors: [
      [
        'Push not received',
        'Firebase not configured / app outdated',
        'Check Mobile Config & FCM; ask user to update app',
      ],
      ['Email bounce', 'Invalid address', 'Correct student email in profile'],
    ],
    faq: [
      {
        q: 'Where are Firebase settings?',
        a: 'Administration → App Version & Mobile Config / Communication Settings as deployed for your tenant.',
      },
    ],
    notes: 'Log campaigns for grievance and NAAC student support evidence.',
  },
  {
    id: 'ch-library',
    title: 'Library (Smart Library)',
    subtitle: 'Catalog, circulation, fines, digital library, and desk operations',
    overview:
      'Smart Library covers cataloguing, accession, circulation, members, reservations, fines, incidents, visitors, digital library, question papers archive, research repository, analytics, NAAC reports, and Library Desk kiosk operations.',
    purpose:
      'Manage physical and digital library operations with member integration to students/staff.',
    useCase: 'Accession new books; issue to student RFID; collect fine; publish digital resources.',
    users: 'Librarian, Library Operator',
    why: 'Library services are accreditation-critical and high-volume daily operations.',
    nav: ['Library', '/admin/library'],
    screen:
      '<p>Library Dashboard, Entry System, Catalog, Accession, Circulation Desk, Members, Reservations, Fines, Incidents, Visitors, Digital Library, Question Papers, Research Repository, Search, Analytics, Reports, NAAC Reports, Settings. Operators may use Library Desk shell.</p>',
    shot: 'Circulation Desk',
    fields: [
      ['Accession number', 'Unique copy ID', 'Yes', 'ACC-45821'],
      ['ISBN / Title', 'Bibliographic identity', 'Yes', 'Introduction to…'],
      ['Member', 'Student/staff library member', 'Yes', 'REG2026048'],
      ['Due date', 'Return deadline', 'System/policy', '25 Jul 2026'],
      ['Fine', 'Overdue charge', 'If due', '₹20'],
    ],
    procedureTitle: 'Issuing a book',
    steps: [
      'Open Circulation Desk; scan/search member (RFID or ID).',
      'Scan accession number; confirm loan rules.',
      'Issue; print/display due date.',
      'On return, collect fine if applicable and close loan.',
    ],
    flow: ['Member check', 'Scan item', 'Issue', 'Return', 'Fine / clearance'],
    practices: [
      'Link members to ERP student/staff IDs — avoid orphan cards.',
      'Run NAAC library reports each semester.',
    ],
    errors: [
      ['Member not found', 'Not enrolled as library member', 'Create member from student/staff'],
      ['Item already issued', 'Prior loan open', 'Force return or locate copy'],
    ],
    faq: [
      {
        q: 'Can students see loans online?',
        a: 'Yes via Student Portal → Library (where enabled).',
      },
    ],
    notes: 'Secure Library Desk terminals; use library-operator role for kiosks.',
  },
  {
    id: 'ch-hr',
    title: 'HR, Payroll & Leave',
    subtitle: 'Employment lifecycle, leave, payroll, PF/NPS, and appraisal',
    overview:
      'HR spans staff directory integration, departments/designations, attendance, leave, substitutes, recruitment (with Careers Portal), appointment orders, joining, probation, salary components/structures/assignments, revisions, increments, payroll runs, loans, accommodation, PF/CPF/NPS, pension, payslips, documents, appraisal, faculty workload, reports, and settings.',
    purpose: 'Operate the full employee lifecycle and statutory payroll processes.',
    useCase: 'Approve faculty leave; run monthly payroll; publish payslips to Staff Portal/mobile.',
    users: 'HR, Accountant, Principal (approvals)',
    why: 'Payroll and leave compliance protect the institution and employees.',
    nav: ['Staff & HR', 'Human Resources', '/admin/hr'],
    screen:
      '<p>HR Dashboard and full HR submenu tree including Leave, Payroll Runs, Payslips, Recruitment, and Settings. Staff view leave/payslips in Staff Portal.</p>',
    shot: 'Payroll Runs',
    fields: [
      ['Pay structure', 'Salary template', 'Yes', 'Assistant Professor Structure'],
      ['Pay period', 'Month', 'Yes', 'June 2026'],
      ['Leave type', 'CL/EL/ML…', 'Yes', 'Casual Leave'],
      ['Leave dates', 'From–to', 'Yes', '14–15 Jul 2026'],
    ],
    procedureTitle: 'Running monthly payroll',
    steps: [
      'Freeze attendance and approved leave for the period.',
      'Verify pay assignments and revisions.',
      'Create Payroll Run; review exceptions (LOP, loans).',
      'Process and publish payslips; notify staff.',
      'Export statutory reports as required.',
    ],
    flow: [
      'Attendance & leave lock',
      'Pay inputs',
      'Payroll run',
      'Review',
      'Payslips',
      'Statutory filing',
    ],
    practices: [
      'Separate HR master edits from payroll processing users when possible.',
      'Keep appointment orders in Documents with digital copies.',
    ],
    errors: [
      ['Payslip missing', 'Employee not in pay assignment', 'Assign structure before run'],
      ['Leave approval stuck', 'Approver not mapped', 'Configure leave workflow / Principal Desk'],
    ],
    faq: [
      {
        q: 'Where do applicants apply for jobs?',
        a: 'Public Careers Portal (/careers-portal), managed under HR Recruitment.',
      },
    ],
    notes: 'Coordinate staff ID card reissue when designation changes.',
  },
  {
    id: 'ch-idcards',
    title: 'Identity & ID Cards',
    subtitle: 'Templates, designer, production, RFID, and print queue',
    overview:
      'Identity & ID Cards provides template gallery, CR80 card designer, student/staff production centers, bulk generation, verification reports, print queue, RFID mapping, reissue, verification portal, reports, and settings — including Pursuit of Excellence branded layouts.',
    purpose: 'Produce secure, printable student and staff identity cards bound to ERP data.',
    useCase:
      'Select Pursuit Excellence template; generate semester batch; print via Evolis; map RFID.',
    users: 'ERP Administrator, Front Office, Academic Admin',
    why: 'Campus access, library, and examinations rely on trusted photo ID.',
    nav: ['Staff & HR / Identity', 'ID Cards', '/admin/id-cards'],
    screen:
      '<p>Dashboard, Template Gallery, Card Designer, Student/Staff Production, Bulk Generation, Verification Report, Print Queue, RFID Mapping, Reissue, Verification Portal, Reports, Settings.</p>',
    shot: 'ID Card Designer',
    fields: [
      ['Template', 'Layout preset', 'Yes', 'DBC Pursuit of Excellence'],
      ['Holder', 'Student/staff', 'Yes', 'REG2026048'],
      ['Photo', 'Portrait', 'Yes', 'Profile photo'],
      ['Validity', 'Valid until', 'Yes', '31 Dec 2029'],
      ['RFID', 'Card chip number', 'As required', 'RFID-00001234'],
    ],
    procedureTitle: 'Producing student ID cards',
    steps: [
      'Ensure photos and addresses are verified in Student profiles.',
      'Select template in Gallery / Designer; set as default if needed.',
      'Open ID Card Production; filter by programme/shift; preview front/back.',
      'Enqueue print jobs; process Print Queue on the card printer.',
      'Map RFID numbers; run Verification Report for audit.',
    ],
    flow: ['Verify data', 'Template', 'Preview', 'Generate', 'Print', 'RFID map', 'Issue'],
    practices: [
      'Put student address on the card back; keep college address distinct.',
      'Reissue lost cards via Card Reissue — do not clone silently.',
      'Test print one card before bulk runs.',
    ],
    errors: [
      ['Blank photo', 'Missing profile photo', 'Upload photo then regenerate'],
      [
        'Print misaligned',
        'Calibration / Evolis feed',
        'Adjust print calibration in designer settings',
      ],
    ],
    faq: [
      {
        q: 'Can students download a soft copy?',
        a: 'Student Portal → ID Card where enabled; physical PVC remains authoritative.',
      },
    ],
    notes: 'Keep principal signature URL configured in ID Card Settings.',
  },
  {
    id: 'ch-inventory',
    title: 'Inventory & Assets',
    subtitle: 'Stores, stock, issue/return, purchase orders, and fixed assets',
    overview:
      'Inventory manages stores, items & stock, issue & return, vendors, purchase orders, barcode labels, requisitions, and restock suggestions. Fixed assets are also tracked under Finance & Accounts.',
    purpose: 'Control consumables and equipment across departments and labs.',
    useCase: 'Raise PO for lab chemicals; issue to department; track low stock.',
    users: 'Store Keeper, Accountant, Lab in-charge',
    why: 'Prevents stockouts and leakage; supports audit of institutional assets.',
    nav: ['Campus Operations', 'Inventory', '/admin/inventory'],
    screen:
      '<p>Dashboard, Stores, Items & Stock, Issue & Return, Vendors, Purchase Orders, Barcode Labels, Requisitions, Restock Suggestions. Fixed Assets under Accounts.</p>',
    shot: 'Inventory Stock list',
    fields: [
      ['Item code / name', 'SKU identity', 'Yes', 'CHEM-HCL-01'],
      ['Store', 'Warehouse location', 'Yes', 'Science Store'],
      ['Quantity', 'On-hand', 'Yes', '12'],
      ['Reorder level', 'Restock trigger', 'Recommended', '5'],
    ],
    procedureTitle: 'Issuing stock to a department',
    steps: [
      'Ensure item exists with sufficient quantity.',
      'Create Issue against department/requester.',
      'Print barcode labels if required for assets.',
      'Record returns when applicable.',
    ],
    flow: ['Requisition', 'Approval', 'PO / stock', 'Issue', 'Return / asset register'],
    practices: [
      'Do physical verification quarterly.',
      'Separate consumables from capitalized fixed assets.',
    ],
    errors: [['Negative stock', 'Issue without receipt', 'Post GRN/receipt first']],
    faq: [
      {
        q: 'Where are buildings/rooms managed?',
        a: 'Infrastructure module under Campus Operations — inventory references locations.',
      },
    ],
    notes: 'Use Restock Suggestions before semester start.',
  },
  {
    id: 'ch-campus-ops',
    title: 'Campus Operations',
    subtitle: 'In-Out (CAMS), infrastructure, front office, and transport',
    overview:
      'Campus Operations groups In-Out Management (CAMS live dashboard and access points), Infrastructure (buildings/rooms), Front Office (enquiries, gate pass, kiosk, complaints), and Transport (routes, vehicles, assignments).',
    purpose: 'Run day-to-day campus logistics and visitor/student movement controls.',
    useCase: 'Issue gate pass; monitor RFID access live; assign bus routes.',
    users: 'Front Office, Transport Coordinator, Security (CAMS), Admin',
    why: 'Safety, hospitality, and logistics need integrated desks.',
    nav: ['Campus Operations', 'CAMS / Infrastructure / Front Office / Transport'],
    screen:
      '<p>Each submodule has its own dashboard. Front Office handles Enquiries, Gate Pass, Kiosk Desk, Complaints. Transport manages Routes & Stops, Vehicles, Assignments, Capacity Alerts.</p>',
    shot: 'CAMS Live Dashboard',
    fields: [
      ['Access point', 'Gate/reader', 'Yes', 'Main Gate'],
      ['Gate pass validity', 'Time window', 'Yes', '2 hours'],
      ['Route', 'Bus path', 'Yes', 'Tura Town Route A'],
      ['Vehicle', 'Bus/van', 'Yes', 'ML-08-XXXX'],
    ],
    procedureTitle: 'Issuing a gate pass',
    steps: [
      'Open Front Office → Gate Pass.',
      'Select student/staff/visitor; enter purpose and return time.',
      'Approve per policy; print or show QR if enabled.',
      'Monitor return; close pass.',
    ],
    flow: ['Request', 'Verify identity', 'Issue pass', 'Exit/entry log', 'Close'],
    practices: [
      'Keep kiosk accounts locked to front-office-desk role.',
      'Review transport capacity alerts before adding assignments.',
    ],
    errors: [
      [
        'RFID not logging',
        'Unmapped RFID or offline point',
        'Map RFID in Students; check access point',
      ],
    ],
    faq: [
      {
        q: 'Is Hostel a full module?',
        a: 'Hosteller flags exist on students; a full hostel module may appear in future editions. Use attributes and reports meanwhile.',
      },
    ],
    notes: 'Integrate CAMS events with incident logs when investigating discipline cases.',
  },
  {
    id: 'ch-governance',
    title: 'Governance, NAAC & Official Documents',
    subtitle: 'Committees, IQAC/NAAC evidence, notices, and e-sign documents',
    overview:
      'Governance manages committees, members, meetings, ATR, notices, and documents. IQAC/NAAC covers criteria, evidence vault, AQAR/SSR, activities, feedback, and compliance. Official Documents manages notices, circulars, office orders, archive, templates, and digital signatures. Principal Desk offers leadership command views.',
    purpose: 'Support institutional governance and accreditation readiness.',
    useCase:
      'Schedule IQAC meeting; attach evidence to Criterion 2; publish office order with e-sign.',
    users: 'Principal, IQAC coordinator, Registrar, Committee members',
    why: 'Accreditation and statutory governance require structured evidence trails.',
    nav: ['Governance / IQAC-NAAC / Official Documents / Principal Desk'],
    screen:
      '<p>Separate dashboards for Governance, NAAC, Official Documents, and Principal Desk (student lookup, fee monitor, leave approvals, institutional health, NAAC readiness).</p>',
    shot: 'NAAC Evidence Repository',
    fields: [
      ['Committee', 'Body name', 'Yes', 'IQAC'],
      ['Meeting date', 'Scheduled meeting', 'Yes', '20 Jul 2026'],
      ['Criterion / metric', 'NAAC mapping', 'Yes', '2.3.1'],
      ['Document type', 'Notice/Circular/Order', 'Yes', 'Office Order'],
    ],
    procedureTitle: 'Publishing an office order',
    steps: [
      'Create document from Official Documents templates.',
      'Route for digital signature / approval.',
      'Publish to audience (staff/students) via Communication if needed.',
      'Archive with searchable metadata.',
    ],
    flow: ['Draft', 'Approve / e-sign', 'Publish', 'Acknowledge', 'Archive / NAAC link'],
    practices: [
      'Tag every evidence file to a NAAC metric on upload.',
      'Keep ATR linked to meeting minutes.',
    ],
    errors: [['Members missing meeting', 'Wrong committee membership', 'Update Committee Members']],
    faq: [
      {
        q: 'Who uses Principal Desk?',
        a: 'Principal, Vice Principal, and ERP Administrator roles for cross-module oversight.',
      },
    ],
    notes: 'Export NAAC readiness snapshots before peer team visits.',
  },
  {
    id: 'ch-reports',
    title: 'Reports & Analytics',
    subtitle: 'Reports Hub, builders, and operational intelligence',
    overview:
      'Reports Hub consolidates student, admission, academic, demographic, department, contact, government, attendance, examination, fee, and certificate reports, plus Export Center, Student Master, Subject Registration reports, Report Builder, and compliance packs. Analytics deep-dives may be edition-dependent.',
    purpose: 'Deliver decision-ready and statutory outputs without spreadsheet sprawl.',
    useCase: 'Export fee outstanding and attendance defaulters for Principal review.',
    users: 'All privileged roles with report permissions',
    why: 'Leadership and regulators expect consistent, reproducible figures.',
    nav: ['Analytics / Reports', '/admin/reports'],
    screen:
      '<p>Categorized report cards, filters (session, programme, shift, date), Export (Excel/PDF/CSV), and saved report builder definitions where enabled.</p>',
    shot: 'Reports Hub',
    fields: [
      ['Report type', 'Catalog selection', 'Yes', 'Fee Outstanding'],
      ['Filters', 'Session/programme/shift', 'Recommended', 'Odd 2026 / All / Morning'],
      ['Export format', 'PDF/Excel/CSV', 'Yes', 'Excel'],
    ],
    procedureTitle: 'Running a filtered export',
    steps: [
      'Open Reports Hub; choose the report card.',
      'Set academic session and demographic filters.',
      'Preview row counts; Export.',
      'Store exports in controlled folders per retention policy.',
    ],
    flow: ['Select report', 'Filter', 'Preview', 'Export', 'Distribute / archive'],
    practices: [
      'Always note filter criteria in email when sharing numbers.',
      'Prefer Report Builder for recurring custom extracts.',
    ],
    errors: [['Empty export', 'Filters too narrow or no permission', 'Widen filters; check role']],
    faq: [
      {
        q: 'Can faculty run admin reports?',
        a: 'Only if granted; otherwise use Staff Portal department reports.',
      },
    ],
    notes: 'Pair monthly exports with Day Closing and attendance registers.',
  },
  {
    id: 'ch-settings',
    title: 'System Administration & Security',
    subtitle: 'License, theme, mobile config, gateways, backup, and audit',
    overview:
      'System Administration covers portal users (see earlier), roll number settings, shift transfer, security & sessions, audit logs, license management, Theme Studio, App Version & Mobile Config, Payment Gateway Management, Knowledge Base, Proposal Studio, Import/Export, and Backup & DR (schedule, repository, restore).',
    purpose: 'Keep the tenant secure, licensed, branded, integrable, and recoverable.',
    useCase:
      'Activate license key; configure Razorpay/Cashfree; set Firebase; schedule nightly backup.',
    users: 'ERP Administrator, Institution Admin, Platform Admin (licenses)',
    why: 'Operational resilience and compliance depend on these controls.',
    nav: ['Administration', 'License / Theme / Mobile / Gateway / Backup'],
    screen:
      '<p>Administration dashboard lists all system tools. License page shows subscription and activation key entry. Backup & DR Center manages schedules and restores. Payment Gateway Management configures providers for fees and admissions.</p>',
    shot: 'License & Backup Center',
    fields: [
      ['Activation key', 'BCLK-… license key', 'Yes for activate', 'BCLK-XXXX-…'],
      ['SMTP / FCM keys', 'Email and push providers', 'As used', '(secure vault)'],
      ['Gateway credentials', 'Merchant keys', 'As used', '(secure vault)'],
      ['Backup schedule', 'Cron/frequency', 'Recommended', 'Daily 02:00'],
    ],
    procedureTitle: 'Activating a license and verifying mobile push',
    steps: [
      'Open Administration → License; enter activation key from BaseCode Labs.',
      'Confirm modules unlocked match your agreement.',
      'Configure Payment Gateway and test a sandbox payment.',
      'Configure App Version & Mobile Config and Firebase for push.',
      'Schedule Backup; perform a test restore in non-production if available.',
      'Review Audit Logs and Security & Sessions policies.',
    ],
    flow: [
      'License activate',
      'Branding',
      'Gateways & Firebase',
      'Backup schedule',
      'Security review',
      'Go-live checklist',
    ],
    practices: [
      'Store API secrets outside screenshots and manuals.',
      'Test restore quarterly.',
      'Rotate admin passwords and revoke unused sessions.',
    ],
    errors: [
      ['License alert banner', 'Expiry approaching/expired', 'Contact licensing@basecodelabs.com'],
      ['Backup failed', 'Storage credentials/permissions', 'Fix repository settings; rerun'],
    ],
    faq: [
      {
        q: 'Who manages platform licenses?',
        a: 'BaseCode Labs Platform Admin (/platform); colleges activate keys locally.',
      },
    ],
    notes: 'Document your gateway and Firebase owners in an internal runbook.',
  },
];

function roleGuide(id, title, body) {
  return `<article class="chapter" id="${id}">
  <header class="chapter-head"><p class="chapter-kicker">Role guide</p><h2>${esc(title)}</h2></header>
  ${body}
</article>`;
}

const css = `
:root {
  --navy: #0b1f3a;
  --navy-2: #123056;
  --maroon: #8b1538;
  --gold: #c5a028;
  --ink: #1e293b;
  --muted: #64748b;
  --line: #e2e8f0;
  --paper: #ffffff;
  --soft: #f8fafc;
  --sky: #e8eef7;
  --radius: 10px;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --sans: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "Cascadia Code", Consolas, monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  color: var(--ink);
  font: 11pt/1.55 var(--sans);
  background: #0f172a;
}
a { color: var(--navy-2); }
.skip { position: absolute; left: -9999px; }
.skip:focus { left: 1rem; top: 1rem; background: #fff; padding: .5rem 1rem; z-index: 99; }
.app-shell { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
.sidebar {
  position: sticky; top: 0; height: 100vh; overflow: auto;
  background: linear-gradient(180deg, var(--navy), #071525);
  color: #e2e8f0; padding: 1.25rem 1rem 2rem;
}
.sidebar .brand { display: flex; gap: .75rem; align-items: center; margin-bottom: 1rem; }
.sidebar .brand img { width: 42px; height: 42px; object-fit: contain; background: #fff; border-radius: 8px; }
.sidebar h1 { font-size: .95rem; margin: 0; color: #fff; }
.sidebar p { margin: .15rem 0 0; font-size: .7rem; color: #94a3b8; }
.sidebar .tools { display: flex; flex-wrap: wrap; gap: .4rem; margin: 1rem 0; }
.sidebar button, .toolbar button {
  border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06);
  color: #fff; border-radius: 999px; padding: .35rem .7rem; font-size: .72rem; cursor: pointer;
}
.sidebar button:hover { background: rgba(255,255,255,.14); }
#toc-nav { font-size: .72rem; }
#toc-nav a { color: #cbd5e1; text-decoration: none; display: block; padding: .22rem .35rem; border-radius: 6px; }
#toc-nav a:hover, #toc-nav a.active { background: rgba(197,160,40,.18); color: #fff; }
#toc-nav .l2 { padding-left: .85rem; opacity: .9; }
.main { background: #334155; }
.doc {
  max-width: 920px; margin: 0 auto; background: var(--paper);
  box-shadow: 0 25px 60px rgba(0,0,0,.35);
}
.page-chrome {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  padding: .55rem 1.25rem; border-bottom: 1px solid var(--line);
  font-size: .68rem; color: var(--muted); background: var(--soft);
}
.page-chrome .left { display: flex; align-items: center; gap: .5rem; }
.page-chrome img { height: 22px; width: auto; }
.page-footer {
  display: flex; justify-content: space-between; gap: 1rem;
  padding: .55rem 1.25rem; border-top: 1px solid var(--line);
  font-size: .65rem; color: var(--muted); background: var(--soft);
}
.content-pad { padding: 1.5rem 2rem 2.5rem; }
.cover, .back-cover, .inside-cover {
  min-height: 100vh; padding: 2.5rem; position: relative;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(197,160,40,.25), transparent 55%),
    radial-gradient(900px 500px at 110% 20%, rgba(139,21,56,.28), transparent 50%),
    linear-gradient(155deg, #071525 0%, #0b1f3a 45%, #123056 100%);
  color: #f8fafc;
  page-break-after: always;
}
.cover-logos { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.cover-logos img { height: 64px; background: #fff; border-radius: 12px; padding: .35rem .55rem; }
.cover-hero { margin-top: 18vh; max-width: 34rem; }
.cover-hero .eyebrow { letter-spacing: .18em; text-transform: uppercase; font-size: .75rem; color: var(--gold); }
.cover-hero h1 { font: 700 2.6rem/1.1 var(--serif); margin: .6rem 0; }
.cover-hero .tag { font-size: 1.15rem; color: #cbd5e1; }
.cover-meta {
  margin-top: 3rem; display: grid; grid-template-columns: 1fr 1fr; gap: .75rem 1.5rem;
  max-width: 32rem; font-size: .9rem;
}
.cover-meta span { display: block; color: #94a3b8; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; }
.cover-bottom { position: absolute; left: 2.5rem; right: 2.5rem; bottom: 2rem; display: flex; justify-content: space-between; font-size: .8rem; color: #94a3b8; }
.inside-cover { background: var(--paper); color: var(--ink); }
.inside-cover h2 { font-family: var(--serif); color: var(--navy); }
.meta-box { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem 1.25rem; background: var(--soft); margin: 1rem 0; }
.version-table td, .version-table th { padding: .45rem .6rem; border-bottom: 1px solid var(--line); text-align: left; font-size: .9rem; }
.chapter { page-break-before: always; padding-top: .5rem; }
.chapter-head { border-bottom: 3px solid var(--navy); margin-bottom: 1.25rem; padding-bottom: .75rem; }
.chapter-kicker { margin: 0; text-transform: uppercase; letter-spacing: .14em; font-size: .7rem; color: var(--maroon); font-weight: 700; }
.chapter-head h2 { font: 700 1.7rem/1.2 var(--serif); color: var(--navy); margin: .25rem 0; }
.chapter-sub { margin: 0; color: var(--muted); }
h3 { color: var(--navy-2); font-size: 1.1rem; margin-top: 1.6rem; border-left: 4px solid var(--gold); padding-left: .6rem; }
h4 { margin-bottom: .35rem; color: var(--navy); }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin: 1rem 0; }
.info-grid > div { background: var(--soft); border: 1px solid var(--line); border-radius: var(--radius); padding: .75rem .9rem; }
.nav-path { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; padding: .75rem 1rem; background: var(--sky); border-radius: var(--radius); font-weight: 600; font-size: .9rem; }
.nav-sep { color: var(--maroon); font-weight: 700; }
.table-wrap { overflow-x: auto; margin: .75rem 0 1rem; }
table { width: 100%; border-collapse: collapse; font-size: .86rem; }
th, td { border: 1px solid var(--line); padding: .45rem .55rem; vertical-align: top; }
th { background: var(--navy); color: #fff; font-weight: 600; }
tr:nth-child(even) td { background: #f8fafc; }
.steps { padding-left: 1.2rem; }
.steps li { margin: .45rem 0; }
.flow { display: flex; flex-direction: column; align-items: center; gap: .35rem; margin: 1rem 0; }
.flow-node {
  min-width: 12rem; text-align: center; padding: .55rem 1rem; border-radius: 999px;
  background: linear-gradient(135deg, var(--navy), var(--navy-2)); color: #fff; font-weight: 600; font-size: .85rem;
  box-shadow: 0 6px 16px rgba(11,31,58,.18);
}
.flow-arrow { color: var(--maroon); font-size: 1.1rem; font-weight: 700; }
ul.check { padding-left: 1.1rem; }
ul.check li { margin: .35rem 0; }
.faq dt { font-weight: 700; margin-top: .75rem; color: var(--navy); }
.faq dd { margin: .25rem 0 .5rem; color: #334155; }
.callout { border-radius: var(--radius); padding: .85rem 1rem; margin: .75rem 0; border: 1px solid var(--line); }
.callout.tip { background: #f0fdf4; border-color: #bbf7d0; }
.callout.warn { background: #fff7ed; border-color: #fed7aa; }
.callout.danger { background: #fef2f2; border-color: #fecaca; }
.note { color: var(--muted); font-size: .9rem; }
.shot { margin: 1rem 0 1.25rem; }
.shot-frame {
  border: 2px dashed #94a3b8; background: repeating-linear-gradient(-45deg, #f8fafc, #f8fafc 10px, #eef2ff 10px, #eef2ff 20px);
  min-height: 160px; display: grid; place-items: center; color: var(--muted); font-weight: 600; border-radius: var(--radius);
}
.shot figcaption { font-size: .78rem; color: var(--muted); margin-top: .35rem; }
.toc-page ol { columns: 2; column-gap: 2rem; }
.toc-page li { break-inside: avoid; margin: .25rem 0; }
.toc-page a { text-decoration: none; }
.back-cover .center { text-align: center; margin-top: 18vh; }
.back-cover h2 { font: 700 2rem/1.15 var(--serif); }
.qr-ph {
  width: 120px; height: 120px; margin: 1.25rem auto; border: 2px dashed rgba(255,255,255,.45);
  display: grid; place-items: center; font-size: .7rem; color: #cbd5e1;
}
.kbd { font-family: var(--mono); font-size: .8rem; background: #e2e8f0; padding: .1rem .35rem; border-radius: 4px; }
@media (max-width: 960px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { position: relative; height: auto; }
  .info-grid, .cover-meta, .toc-page ol { grid-template-columns: 1fr; columns: 1; }
}
@media print {
  body { background: #fff; }
  .app-shell { display: block; }
  .sidebar, .no-print { display: none !important; }
  .main { background: #fff; }
  .doc { max-width: none; box-shadow: none; }
  .cover, .inside-cover, .back-cover, .chapter { break-after: page; page-break-after: always; }
  a { color: inherit; text-decoration: none; }
  .shot-frame { min-height: 120px; }
  @page { size: A4; margin: 14mm 12mm 16mm; }
}
`;

const introHtml = `
<article class="chapter" id="ch-intro">
  <header class="chapter-head"><p class="chapter-kicker">Part I</p><h2>Introduction</h2>
  <p class="chapter-sub">Welcome to ${META.product}</p></header>
  <p><strong>${META.product}</strong> is an enterprise campus management platform by <strong>${META.company}</strong>. It unifies admissions, academics (NEP/FYUGP), attendance, examinations, fees &amp; accounts, HR &amp; payroll, library, communication, governance/NAAC, identity cards, inventory, transport, and mobile apps into one licensed tenant.</p>
  <h3>Who this manual is for</h3>
  <ul>
    <li>College administrators and ERP administrators</li>
    <li>Admission, academic, examination, accounts, HR, and library officers</li>
    <li>Faculty and HODs using the Staff Portal / mobile app</li>
    <li>Students and applicants using web and mobile portals</li>
    <li>Principals using Principal Desk</li>
  </ul>
  <h3>Document conventions</h3>
  <ul>
    <li><span class="kbd">Bold</span> menu paths show navigation.</li>
    <li>Screenshot frames marked <em>[Insert … Screenshot]</em> are reserved for your institution’s visuals.</li>
    <li>Field tables list Mandatory = Yes/No/Recommended/System.</li>
  </ul>
  ${shot('Product architecture / portal map')}
  <div class="callout tip"><strong>Support.</strong> ${META.email} · ${META.phone} · ${META.website}</div>
</article>

<article class="chapter" id="ch-requirements">
  <header class="chapter-head"><p class="chapter-kicker">Part I</p><h2>System Requirements</h2></header>
  <h3>Server / SaaS</h3>
  <p>Institutions typically receive a hosted tenant URL from BaseCode Labs. On-premise deployments follow the contracted infrastructure schedule.</p>
  <h3>Administrator &amp; staff workstations</h3>
  ${fieldTable([
    ['OS', 'Windows 10/11, macOS 12+, or current Linux LTS', 'Yes', 'Windows 11'],
    ['Browser', 'Chrome, Edge, or Firefox (latest 2 versions)', 'Yes', 'Chrome 125+'],
    ['Display', '1366×768 minimum; 1920×1080 recommended', 'Yes', '1080p'],
    ['Network', 'Stable broadband; HTTPS required', 'Yes', '20 Mbps+ shared'],
    ['PDF / print', 'System PDF printer for exports', 'Recommended', 'Microsoft Print to PDF'],
  ])}
  <h3>Mobile</h3>
  <p>Android device meeting current Play Store policy for <strong>BCL OneCampus ERP</strong> (package <code>edu.onecampus.mobile</code>). iOS availability depends on your rollout plan. Push notifications require Firebase configuration by the administrator.</p>
  ${shot('Supported browsers matrix')}
</article>

<article class="chapter" id="ch-getting-started">
  <header class="chapter-head"><p class="chapter-kicker">Part I</p><h2>Getting Started</h2></header>
  <h3>Portals at a glance</h3>
  <div class="table-wrap"><table>
    <thead><tr><th>Portal</th><th>Typical URL path</th><th>Primary users</th></tr></thead>
    <tbody>
      <tr><td>Admin</td><td>/admin</td><td>College / academic / accounts admins</td></tr>
      <tr><td>Staff / Faculty</td><td>/staff</td><td>Teaching &amp; non-teaching staff</td></tr>
      <tr><td>Student</td><td>/student</td><td>Enrolled students</td></tr>
      <tr><td>Principal Desk</td><td>/principal-desk</td><td>Principal, VP, ERP Admin</td></tr>
      <tr><td>Admissions Portal</td><td>/admissions-portal</td><td>Applicants</td></tr>
      <tr><td>Library Desk</td><td>/library-desk</td><td>Library operators</td></tr>
      <tr><td>Careers Portal</td><td>/careers-portal</td><td>Job applicants</td></tr>
      <tr><td>Mobile app</td><td>Play Store / APK</td><td>Students &amp; staff</td></tr>
    </tbody>
  </table></div>
  <h3>Login procedure</h3>
  ${steps([
    'Open your institution’s OneCampus URL.',
    'Select the correct institution/school if prompted (multi-tenant / mobile).',
    'Enter username/email and password.',
    'Complete first-login password change if required.',
    'Land on the portal home determined by your role.',
  ])}
  ${navPath(['Browser', 'Login', 'Role-based home'])}
  ${shot('Login screen')}
  <div class="callout warn"><strong>Security.</strong> Never share passwords. Use Security &amp; Sessions to revoke lost-device sessions.</div>
</article>
`;

const adminGuide = roleGuide(
  'ch-admin-guide',
  'Administrator Guide',
  `
  <p>This section is the recommended go-live and operations checklist for ERP Administrators and Institution Admins.</p>
  <h3>Go-live sequence</h3>
  ${flow([
    'License activation',
    'Organization & branding',
    'Academic year / sessions',
    'Shifts',
    'Users & roles',
    'Fee & gateway',
    'Communication / Firebase',
    'Backup schedule',
    'Pilot users',
    'Production cutover',
  ])}
  <h3>Academic year &amp; semester activation</h3>
  <p>Create the academic session under <strong>Academics → Academic Sessions</strong>, activate the semester, and align fee cycles and timetable plans to the same session codes.</p>
  <h3>Shift configuration</h3>
  <p>Configure Morning/Evening (or custom) shifts under <strong>Shift Management</strong>. Teaching allocation, attendance, and fee plans should reference the same shift masters.</p>
  <h3>Payment gateway</h3>
  <p>Open <strong>Administration → Payment Gateway Management</strong>. Enter merchant credentials, enable Fee / Admission / Exam Fee channels as licensed, and run a ₹1 test where supported.</p>
  <h3>Email, SMS, WhatsApp, Firebase</h3>
  <p>Configure providers in Communication Settings and Mobile Config. Send a test push to a staff device before student campaigns.</p>
  <h3>Backup &amp; restore</h3>
  <p>Use <strong>Backup &amp; DR Center</strong> to schedule backups, verify repository connectivity, and document restore owners.</p>
  ${shot('Administrator go-live checklist worksheet')}
  <div class="callout tip"><strong>Note.</strong> Custom tenant-edited ID card layouts are preserved; library defaults refresh when <em>layoutRevision</em> advances — use Reset to library when you intentionally want the latest Pursuit Excellence layout.</div>
`,
);

const studentGuide = roleGuide(
  'ch-student-guide',
  'Student Guide',
  `
  <p>Students use the <strong>Student Portal</strong> (web) and <strong>BCL OneCampus</strong> mobile app.</p>
  <h3>Typical student journey</h3>
  ${flow(['Login', 'Complete profile', 'Timetable', 'Attendance', 'LMS / fees', 'Exams', 'Results'])}
  <h3>Key screens</h3>
  <ul>
    <li><strong>Dashboard</strong> — notices and shortcuts</li>
    <li><strong>My Profile</strong> — personal, contact, guardians, documents, Class XII, submit for verification</li>
    <li><strong>Attendance / Timetable / LMS</strong> — academics</li>
    <li><strong>Fees / Semester Exam Fees</strong> — pay and download receipts</li>
    <li><strong>Examinations / Results / Hall ticket</strong> — as published</li>
    <li><strong>Library, Certificates, Feedback, ID Card, Support</strong></li>
  </ul>
  ${steps([
    'Install the mobile app or open the student portal URL.',
    'Sign in with credentials issued by the college.',
    'Complete My Profile and submit for verification.',
    'Check Timetable and Attendance weekly.',
    'Pay fees from Fees or Exam Fees before deadlines.',
    'Enable notifications for alerts from the Communication Center.',
  ])}
  ${shot('Student mobile home')}
`,
);

const facultyGuide = roleGuide(
  'ch-faculty-guide',
  'Faculty Guide',
  `
  <p>Faculty use the <strong>Staff Portal</strong> and mobile faculty workspace.</p>
  <h3>Daily teaching loop</h3>
  ${flow(['My Subjects', 'Timetable', 'Attendance entry', 'LMS / assignments', 'Marks / IA', 'Leave if needed'])}
  <h3>Capabilities</h3>
  <ul>
    <li>My Subjects, Teaching Load, Timetable</li>
    <li>LMS workspace, lesson plans, homework</li>
    <li>Question Paper Repository uploads</li>
    <li>Attendance entry and student lists</li>
    <li>Internal assessment / marks entry</li>
    <li>Leave applications; payslips under Salary</li>
    <li>Department notices and committee memberships</li>
  </ul>
  ${shot('Faculty attendance entry')}
  <div class="callout tip"><strong>Tip.</strong> Mark attendance the same day; locked periods may require academic admin unlock.</div>
`,
);

const mobileGuide = roleGuide(
  'ch-mobile-guide',
  'Mobile Application Guide',
  `
  <h3>Installation</h3>
  <p>Install <strong>BCL OneCampus ERP</strong> from the institution’s Play Store listing or the APK provided by BaseCode Labs / your admin. Accept notification permission for alerts.</p>
  <h3>Student tabs</h3>
  <p>Home · My Academics · Fees · Alerts · Profile</p>
  <h3>Faculty tabs</h3>
  <p>Home · Academics · Attendance · Students · Profile</p>
  <h3>Offline behaviour</h3>
  <p>Some screens cache recent data; posting attendance or payments requires connectivity. If offline, the app shows a retry state — do not assume server success until confirmed.</p>
  <h3>Troubleshooting</h3>
  <ul>
    <li>Update to the latest version from Administration’s published version code.</li>
    <li>Clear app cache only after admin advice.</li>
    <li>Re-login after password reset on web.</li>
  </ul>
  ${shot('Mobile login / select school')}
`,
);

const troubleshooting = `
<article class="chapter" id="ch-troubleshooting">
  <header class="chapter-head"><p class="chapter-kicker">Support</p><h2>Troubleshooting Guide</h2></header>
  <h3>Login problems</h3>
  <ul>
    <li>Confirm portal (Admin vs Student vs Staff).</li>
    <li>Use Forgot Password; check spam for reset mail.</li>
    <li>Ask admin to verify User Activation and role mapping.</li>
  </ul>
  <h3>Password reset</h3>
  <p>Web login → Forgot Password → open email link → set new password → sign in on mobile again.</p>
  <h3>Payment failure</h3>
  <ul>
    <li>Do not pay twice immediately — wait for gateway callback.</li>
    <li>Accounts can confirm via Fee Verification / External Payment Entry.</li>
    <li>Keep UTR/UPI reference for reconciliation.</li>
  </ul>
  <h3>Notification issues</h3>
  <ul>
    <li>Enable OS notifications; confirm Firebase configured.</li>
    <li>Ensure the user is in the campaign audience.</li>
  </ul>
  <h3>Attendance issues</h3>
  <ul>
    <li>Students missing: check subject registration/section.</li>
    <li>Staff biometric empty: device connectivity and pull logs.</li>
  </ul>
  <h3>Mobile app issues</h3>
  <ul>
    <li>Wrong school selected on multi-tenant login.</li>
    <li>Force update if App Version policy requires it.</li>
  </ul>
  ${shot('Error / access denied example')}
</article>
`;

const faqGlobal = `
<article class="chapter" id="ch-faq">
  <header class="chapter-head"><p class="chapter-kicker">Support</p><h2>Frequently Asked Questions</h2></header>
  <dl class="faq">
    <dt>Is OneCampus NEP / FYUGP ready?</dt>
    <dd>Yes. Curriculum baskets (Major, Minor, MDC, AEC, SEC, VAC, VTC) and session/shift models support FYUGP operations.</dd>
    <dt>Can we customize ID cards?</dt>
    <dd>Yes via Template Gallery and Card Designer. Default Pursuit of Excellence layouts can be refreshed by library revision.</dd>
    <dt>How is licensing enforced?</dt>
    <dd>Administration → License shows status; activate keys from BaseCode Labs. Banners appear before expiry.</dd>
    <dt>Where do I configure Pay now on mobile?</dt>
    <dd>Fee Settings and Payment Gateway Management control student app payment behaviour.</dd>
    <dt>What if Analytics shows Coming soon?</dt>
    <dd>Use Reports Hub; advanced analytics tiles depend on edition/feature flags.</dd>
    <dt>Is there a parent portal?</dt>
    <dd>A parent role stub exists; full parent portal availability depends on your contracted edition.</dd>
    <dt>How do we get training?</dt>
    <dd>Contact ${META.email} or ${META.phone} for onboarding packages.</dd>
  </dl>
</article>
`;

const glossary = `
<article class="chapter" id="ch-glossary">
  <header class="chapter-head"><p class="chapter-kicker">Reference</p><h2>Glossary</h2></header>
  <div class="table-wrap"><table>
    <thead><tr><th>Term</th><th>Definition</th></tr></thead>
    <tbody>
      ${[
        [
          'Academic Year / Session',
          'Institutional teaching year or named session window in OneCampus',
        ],
        ['Semester', 'Odd/Even instructional term within a programme'],
        ['Programme', 'Award pathway such as B.A. Economics'],
        ['Curriculum', 'Versioned rule set of courses and baskets for a cohort'],
        ['CBCS', 'Choice Based Credit System'],
        ['FYUGP', 'Four Year Undergraduate Programme under NEP'],
        ['MDC', 'Multidisciplinary Course'],
        ['AEC', 'Ability Enhancement Course'],
        ['SEC', 'Skill Enhancement Course'],
        ['VAC', 'Value Added Course'],
        ['VTC', 'Vocational / skill track course as configured'],
        ['Batch / Section', 'Teaching group under a subject offering'],
        ['Shift', 'Morning/Evening delivery window'],
        ['Demand', 'Fee charge raised against a student ledger'],
        ['IA', 'Internal Assessment'],
        ['RFID', 'Radio frequency identity mapped to student/staff'],
        ['ABC ID', 'Academic Bank of Credits identity where used'],
        ['ATR', 'Action Taken Report for committee meetings'],
        ['AQAR / SSR', 'NAAC annual quality / self-study report artefacts'],
        ['Tenant', 'Isolated college instance of OneCampus'],
        ['CR80', 'Standard PVC ID card size used by the designer'],
      ]
        .map((r) => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td></tr>`)
        .join('')}
    </tbody>
  </table></div>
</article>
`;

const appendix = `
<article class="chapter" id="ch-appendix">
  <header class="chapter-head"><p class="chapter-kicker">Reference</p><h2>Appendix</h2></header>
  <h3>Keyboard shortcuts</h3>
  ${fieldTable([
    ['Ctrl + K', 'Command palette / OneCampus AI', 'No', 'Admin web'],
    ['Browser Ctrl + P', 'Print / Save as PDF this manual', 'No', 'Any'],
  ])}
  <h3>Browser compatibility</h3>
  <p>Chrome, Edge, Firefox — latest two major versions. Safari supported for general browsing; print CSS validated primarily on Chromium.</p>
  <h3>Mobile requirements</h3>
  <p>Android as published on Play Store for BCL OneCampus ERP; notification permission recommended; storage for offline cache optional.</p>
  <h3>Role matrix (summary)</h3>
  <p>Seeded roles include college-admin, institution-admin, academic-admin, admission-admin, faculty, staff, student, accountant, librarian, library-operator, examination-cell, registrar, principal, vice-principal, erp-administrator, shift-* coordinators, front-office-desk, transport-coordinator, store-keeper, applicant, platform-admin, and others. Exact permissions are configured per tenant.</p>
  ${shot('Permission matrix export')}
</article>
`;

const lmsShort = moduleChapter({
  id: 'ch-lms',
  title: 'Learning Management (LMS)',
  subtitle: 'Subject workspaces, materials, assignments, quizzes, discussions',
  overview:
    'LMS provides subject workspaces for learning materials, assignments, quizzes, discussions, lesson plans, and settings — available to faculty and students on web and mobile.',
  purpose: 'Digitize teaching content and continuous assessment artefacts.',
  useCase: 'Faculty uploads week-2 notes and an assignment; students submit before deadline.',
  users: 'Faculty, Students, Academic Admin',
  why: 'Centralizes teaching artefacts for audit and student access.',
  nav: ['Academic Operations', 'LMS', '/admin/academics/lms'],
  screen:
    '<p>Dashboard, Subject Workspaces, Materials, Assignments, Quizzes, Discussions, Lesson Plans, Settings. Student portal mirrors enrolled subjects.</p>',
  fields: [
    ['Workspace', 'Subject LMS space', 'Yes', 'EDN-DSC-301'],
    ['Material title', 'Resource name', 'Yes', 'Unit 2 Notes'],
    ['Assignment due', 'Deadline', 'Yes', '20 Jul 2026 23:59'],
  ],
  steps: [
    'Open LMS → Subject Workspace for your paper.',
    'Upload materials or create assignment/quiz.',
    'Publish visibility to enrolled students.',
    'Grade submissions and release feedback.',
  ],
  flow: ['Workspace', 'Content', 'Publish', 'Submissions', 'Grading'],
  practices: ['Use clear week-wise folders.', 'Align deadlines with timetable weeks.'],
  errors: [
    [
      'Students cannot see content',
      'Not published or not enrolled',
      'Publish; verify registration',
    ],
  ],
  faq: [
    {
      q: 'Are lesson plans mandatory?',
      a: 'Policy-dependent; recommended for NAAC teaching plans.',
    },
  ],
  notes: 'Export assignment analytics for departmental reviews.',
});

const certificatesShort = moduleChapter({
  id: 'ch-certificates',
  title: 'Certificates',
  subtitle: 'Templates, generation, bulk issue, verification',
  overview:
    'Certificates module covers templates, generator, requests, bulk issue, verification, approval workflow, analytics, audit logs, and settings for bonafide and related credentials.',
  purpose: 'Issue verifiable institutional certificates with audit trail.',
  useCase: 'Bulk issue bonafide certificates for scholarship applications.',
  users: 'Registrar, Academic Admin, Front Office',
  why: 'Reduces forged paper credentials via verification portal.',
  nav: ['Examination / Certificates', '/admin/certificates'],
  screen:
    '<p>Dashboard, Templates, Generator, Requests, Bulk Issue, Verification, Approvals, Analytics, Audit, Settings.</p>',
  fields: [
    ['Template', 'Certificate layout', 'Yes', 'Bonafide'],
    ['Student', 'Recipient', 'Yes', 'REG2026048'],
    ['Verification code', 'Public verify token', 'System', 'auto'],
  ],
  steps: [
    'Select template; preview merge fields.',
    'Generate for one student or bulk cohort.',
    'Approve if workflow enabled; publish/download.',
    'Share verification link as needed.',
  ],
  flow: ['Request', 'Generate', 'Approve', 'Issue', 'Verify'],
  practices: ['Lock templates after academic council approval.'],
  errors: [
    ['Wrong name on certificate', 'Profile name outdated', 'Update profile then regenerate'],
  ],
  faq: [
    {
      q: 'Public verification URL?',
      a: 'Use Certificates → Verification / public verify routes as configured.',
    },
  ],
  notes: 'Retain audit logs with issued serials.',
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(META.product)} — ${esc(META.title)}</title>
<meta name="author" content="${esc(META.company)}" />
<meta name="description" content="Enterprise User Manual and Administration Guide for ${esc(META.product)}" />
<style>${css}</style>
</head>
<body>
<a class="skip" href="#document-root">Skip to document</a>
<div class="app-shell">
  <aside class="sidebar no-print" aria-label="Manual navigation">
    <div class="brand">
      <img src="bcl-logo.png" alt="BaseCode Labs" />
      <div>
        <h1>${esc(META.product)}</h1>
        <p>User Manual ${esc(META.docVersion)}</p>
      </div>
    </div>
    <div class="tools">
      <button type="button" id="btn-print">Print / PDF</button>
      <button type="button" id="btn-top">Top</button>
    </div>
    <nav id="toc-nav" aria-label="Table of contents"></nav>
  </aside>
  <div class="main">
    <div class="doc" id="document-root">

      <!-- COVER -->
      <section class="cover" id="cover">
        <div class="cover-logos">
          <img src="bcl-logo.png" alt="BaseCode Labs Pvt. Ltd." />
          <img src="onecampus-logo.png" alt="BCL OneCampus ERP" />
        </div>
        <div class="cover-hero">
          <p class="eyebrow">Official Product Documentation</p>
          <h1>${esc(META.product)}<br/>${esc(META.title)}</h1>
          <p class="tag">${esc(META.tagline)}</p>
        </div>
        <div class="cover-meta">
          <div><span>Product version</span><strong>${esc(META.version)}</strong></div>
          <div><span>Document version</span><strong>${esc(META.docVersion)}</strong></div>
          <div><span>Release date</span><strong>${esc(META.releaseDate)}</strong></div>
          <div><span>Company</span><strong>${esc(META.company)}</strong></div>
          <div><span>Website</span><strong>${esc(META.website)}</strong></div>
          <div><span>Email</span><strong>${esc(META.email)}</strong></div>
          <div><span>Phone</span><strong>${esc(META.phone)}</strong></div>
          <div><span>Classification</span><strong>Confidential — Licensed Customers</strong></div>
        </div>
        <div class="cover-bottom">
          <span>${esc(META.copyright)}</span>
          <span>Printed from HTML · A4</span>
        </div>
      </section>

      <!-- INSIDE COVER -->
      <section class="inside-cover content-pad" id="inside-cover">
        <div class="page-chrome">
          <div class="left"><img src="bcl-logo.png" alt="" /><strong>${esc(META.company)}</strong></div>
          <div>${esc(META.product)} · ${esc(META.docVersion)}</div>
        </div>
        <h2>Inside cover</h2>
        <div class="meta-box">
          <p><strong>Copyright notice.</strong> ${esc(META.copyright)} No part of this publication may be reproduced or distributed outside licensed customer institutions without prior written consent of BaseCode Labs Pvt. Ltd.</p>
          <p><strong>Confidentiality.</strong> This manual contains proprietary product information. Distribute only to authorized staff of licensed colleges.</p>
          <p><strong>Disclaimer.</strong> Screens, labels, and workflows may vary by license edition, feature flags, and tenant configuration. Screenshots are illustrative placeholders until replaced with your production captures.</p>
        </div>
        <h3>Document version history</h3>
        <table class="version-table">
          <thead><tr><th>Version</th><th>Date</th><th>Author</th><th>Changes</th></tr></thead>
          <tbody>
            <tr><td>${esc(META.docVersion)}</td><td>${esc(META.releaseDate)}</td><td>BaseCode Labs Product Documentation</td><td>Initial enterprise HTML manual covering all major OneCampus modules, role guides, and appendices.</td></tr>
          </tbody>
        </table>
        <h3>Prepared by</h3>
        <p>Product Documentation Team · ${esc(META.company)}</p>
        <h3>Company &amp; support</h3>
        <p>Website: <a href="${esc(META.website)}">${esc(META.website)}</a><br/>
        Email: <a href="mailto:${esc(META.email)}">${esc(META.email)}</a><br/>
        Licensing: <a href="mailto:${esc(META.licensingEmail)}">${esc(META.licensingEmail)}</a><br/>
        Phone: ${esc(META.phone)}</p>
        <div class="page-footer">
          <span>${esc(META.copyright)}</span>
          <span class="pg"></span>
        </div>
      </section>

      <!-- TOC -->
      <section class="content-pad toc-page chapter" id="toc">
        <div class="page-chrome">
          <div class="left"><img src="bcl-logo.png" alt="" /><strong>${esc(META.product)}</strong></div>
          <div>Table of Contents · ${esc(META.docVersion)}</div>
        </div>
        <header class="chapter-head"><p class="chapter-kicker">Contents</p><h2>Table of Contents</h2></header>
        <ol id="toc-list"></ol>
        <div class="page-footer"><span>${esc(META.copyright)}</span><span class="pg"></span></div>
      </section>

      <div class="content-pad" id="body-chapters">
        ${introHtml}
        ${MODULES.map(moduleChapter).join('\n')}
        ${lmsShort}
        ${certificatesShort}
        ${adminGuide}
        ${studentGuide}
        ${facultyGuide}
        ${mobileGuide}
        ${troubleshooting}
        ${faqGlobal}
        ${glossary}
        ${appendix}
      </div>

      <!-- BACK COVER -->
      <section class="back-cover" id="back-cover">
        <div class="center">
          <img src="bcl-logo.png" alt="BaseCode Labs" style="height:72px;background:#fff;border-radius:12px;padding:.4rem .6rem;" />
          <h2>${esc(META.company)}</h2>
          <p style="color:var(--gold);letter-spacing:.12em;text-transform:uppercase;font-size:.8rem;">Your Technology Growth Partner</p>
          <p style="max-width:28rem;margin:1rem auto;color:#cbd5e1;">${esc(META.product)} — ${esc(META.tagline)}</p>
          <div class="qr-ph">[QR Code<br/>Website]</div>
          <p>
            Website: ${esc(META.website)}<br/>
            Email: ${esc(META.email)}<br/>
            Phone: ${esc(META.phone)}
          </p>
          <p style="margin-top:2rem;color:#94a3b8;font-size:.85rem;">
            Document ${esc(META.docVersion)} · Product ${esc(META.version)} · ${esc(META.releaseDate)}<br/>
            ${esc(META.copyright)}
          </p>
        </div>
      </section>

    </div>
  </div>
</div>
<script>
(function () {
  const tocNav = document.getElementById('toc-nav');
  const tocList = document.getElementById('toc-list');
  const chapters = [...document.querySelectorAll('#body-chapters .chapter, #toc')];
  const heads = [...document.querySelectorAll('#body-chapters h2, #cover, #inside-cover, #toc h2, #back-cover')];

  function addToc(href, label, level) {
    const a = document.createElement('a');
    a.href = href; a.textContent = label; if (level === 2) a.className = 'l2';
    tocNav.appendChild(a);
    if (tocList && level === 1) {
      const li = document.createElement('li');
      const la = document.createElement('a');
      la.href = href; la.textContent = label;
      li.appendChild(la); tocList.appendChild(li);
    }
  }

  addToc('#cover', 'Cover', 1);
  addToc('#inside-cover', 'Inside cover', 1);
  addToc('#toc', 'Table of contents', 1);

  document.querySelectorAll('#body-chapters .chapter').forEach((ch) => {
    const h2 = ch.querySelector('h2');
    if (!h2) return;
    if (!ch.id) ch.id = 'sec-' + Math.random().toString(36).slice(2, 8);
    addToc('#' + ch.id, h2.textContent.trim(), 1);
    ch.querySelectorAll('h3').forEach((h3, idx) => {
      if (!h3.id) h3.id = ch.id + '-s' + idx;
      addToc('#' + h3.id, h3.textContent.trim(), 2);
    });
  });
  addToc('#back-cover', 'Back cover', 1);

  // Wrap chapters with chrome for print identity
  document.querySelectorAll('#body-chapters .chapter').forEach((ch) => {
    const chrome = document.createElement('div');
    chrome.className = 'page-chrome';
    chrome.innerHTML = '<div class="left"><img src="bcl-logo.png" alt="" /><strong>${esc(META.product)}</strong></div><div>${esc(META.docVersion)} · ${esc(META.company)}</div>';
    ch.insertBefore(chrome, ch.firstChild);
    const foot = document.createElement('div');
    foot.className = 'page-footer';
    foot.innerHTML = '<span>${esc(META.copyright)}</span><span class="pg"></span>';
    ch.appendChild(foot);
  });

  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('Wrote', OUT, '(' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
