# BCL OneCampus — Demo Script for Principal & Staff

**Duration:** 50–70 minutes (full tour) · **Short version:** 25 minutes (Sections 1–4 + 8)  
**Presenter:** ERP implementation lead / IT coordinator  
**Audience:** Principal, Vice-Principal, Registrar, HODs, office staff  
**Environment:** http://localhost:3000 (or production URL)

---

## Before you begin

### Pre-demo checklist (15 minutes earlier)

- [ ] `docker compose up -d postgres redis` running
- [ ] `npm run dev` — Web on **3000**, API on **3001**
- [ ] Database seeded (`npm run db:seed`)
- [ ] Browser: Chrome/Edge, zoom 100%, bookmarks ready
- [ ] Second monitor or projector tested
- [ ] Close unrelated tabs; disable notifications
- [ ] Have this script on a tablet or printed copy

### Login credentials (write on whiteboard)

| Portal                     | Tenant | Email                       | Password      |
| -------------------------- | ------ | --------------------------- | ------------- |
| **Admin (Principal view)** | `demo` | `admin@demo.edu`            | `Admin@123`   |
| **Faculty**                | `demo` | `francis.momin@demo.edu`    | `Faculty@123` |
| **Student**                | `demo` | `demo.student.001@demo.edu` | `Student@123` |

> **Tip:** Use **Ctrl+K** (command palette) during demo to show instant student search by name, roll number, or ABC ID.

---

## Section 1 — Opening for the Principal (5 minutes)

### What to say

> "Good morning. Today I will walk you through **BCL OneCampus** — our NEP-2020 aligned College ERP. This is not a collection of separate software tools. It is one integrated platform where admission, academics, examinations, fees, HR, governance, and NAAC evidence all share the same student and staff records.
>
> The system is built for **multi-shift colleges**, supports **FYUGP semester registration**, captures **ABC IDs** for UGC compliance, and gives us a **NAAC/IQAC evidence trail** from day-to-day operations.
>
> I will show the **Admin view** as you would see it, then briefly the **Faculty** and **Student** portals so you can see the full journey."

### Key messages for leadership

1. **Single source of truth** — one student record from application to alumni
2. **NEP-ready** — CBCS, major/minor/MDC registration, credit tracking
3. **Accountability** — role-based access, audit logs, committee governance
4. **Accreditation-ready** — NAAC criteria, evidence vault, AQAR support
5. **Modern stack** — secure, scalable, cloud-deployable

### Show (30 seconds)

- Login page → enter tenant `demo`, email, password
- Land on **Admin Dashboard** — point out KPI cards and quick navigation

---

## Section 2 — Dashboard & institution overview (4 minutes)

**Path:** `/admin` → `/admin/analytics`

### Demo steps

1. **Admin Dashboard** — enrollment snapshot, pending tasks, module shortcuts
2. **Institution Analytics** — cross-module charts (admissions funnel, fee collection trends if seeded)
3. Press **Ctrl+K** — type a student roll number or name → open profile directly

### Talking points

- "The Principal sees institution-wide KPIs without asking each department for Excel sheets."
- "Every user sees only what their role permits — a librarian does not see payroll."
- "Global search finds any student in seconds — including by **ABC ID**."

---

## Section 3 — Admissions pipeline (6 minutes)

**Path:** `/admin/admissions`

### Demo flow (follow this order)

| Step | Menu                  | What to show                             |
| ---- | --------------------- | ---------------------------------------- |
| 1    | Control center        | Admission cycle status, stage counts     |
| 2    | Application form      | Online application fields (configurable) |
| 3    | Document verification | Pending vs verified documents            |
| 4    | Payment verification  | Fee payment status                       |
| 5    | Merit & selection     | Merit list generation                    |
| 6    | Admitted students     | Convert applicant → enrolled student     |
| 7    | Analytics             | Conversion and source reports            |

### Highlight: ABC ID at admission

1. Open an admission or **Add Student** flow (`/admin/students/new`)
2. Show **ABC ID** field in basic details (optional at entry, tracked later)
3. Mention bulk upload path: **Students → Upload ABC IDs**

### Talking points

- "From enquiry to enrolled student — no re-typing data in Excel."
- "Document and payment verification gates prevent incomplete admissions."
- "ABC ID can be captured at admission or mass-updated later with audit trail."

---

## Section 4 — Student lifecycle (8 minutes)

**Path:** `/admin/students`

### Demo steps

1. **Student Records** — directory with filters (programme, shift, status, **ABC status**)
2. Click a student → **360° profile**:
   - Personal & contact
   - Academic identity (roll, enrollment, **ABC ID**)
   - Programme, shift, registration history
   - Documents, fees snapshot, attendance summary
3. **Bulk Import** — CSV template for mass onboarding
4. **Subject Registration** — admin-assisted course registration
5. **Semester Promotion** — promote cohort to next semester
6. **Upload ABC IDs** — download template, upload CSV, show validation
7. **Student Reports** (via profile area or reports hub) — ABC coverage statistics

### Talking points

- "One profile follows the student for four years — no folder of paper files."
- "Bulk tools handle 3,000+ students; filters find defaulters, unverified ABC, etc."
- "Every change is logged — important for audits and NAAC."

---

## Section 5 — Academics & NEP engine (8 minutes)

**Paths:** `/admin/programs` · `/admin/academic-engine` · `/admin/academic-lifecycle`

### Demo steps

1. **Programmes & Courses** — BCA, BA, etc.; programme versions and course catalogue
2. **Academic Engine (Curriculum Mapping)**:
   - Select programme version
   - Show FYUGP structure (Sem 1–3): MAJOR, MINOR, MDC, AEC, SEC, VAC
   - Offerings & seat capacity
   - Registration windows (open/close dates)
3. **Academic Sessions / Semester Lifecycle** — current session, active semester
4. **Shift Management** — Morning / Day / Evening shifts (if applicable)

### Talking points

- "NEP four-year structure is configured once; students register within validated rules."
- "MDC cannot clash with major/minor — system enforces NEP category rules."
- "FCFS seat allocation with waitlist — transparent and automated."
- "Multi-shift colleges operate independently within one institution."

### Optional deep dive

Open [ACADEMIC_ENGINE.md](./ACADEMIC_ENGINE.md) talking points if Principal asks technical questions.

---

## Section 6 — Timetable & teaching allocation (5 minutes)

**Path:** `/admin/academics/timetable`

### Demo steps

1. **Dashboard** — published vs draft plans
2. **Subject Groups** — pool sections for large programmes
3. **Teaching Allocation** — faculty assigned to sections
4. **Timetable Plans** → **Generation Engine** → **Conflict Resolution** → **Publish**
5. Show published timetable (faculty and student see the same data)

### Talking points

- "Timetable is generated from rooms, faculty availability, and subject groups — not manual Excel grids."
- "Conflicts are flagged before publish — no double-booked labs."
- "Once published, faculty and students see it instantly on their portals."

---

## Section 7 — LMS, Question Bank & attendance (6 minutes)

### 7A — LMS

**Path:** `/admin/academics/lms`

- Subject workspaces, materials upload, assignments, quizzes, lesson plans
- "Extends classroom beyond physical periods — especially for assignments and study material."

### 7B — Question Bank

**Path:** `/admin/academics/question-bank`

- Previous year papers, faculty upload, approval workflow, controlled student access
- "Builds an institutional question repository for internal assessment quality."

### 7C — Student Attendance

**Path:** `/admin/academics/attendance`

- Session attendance, defaulter lists
- Link to **Reports → Attendance Defaulters**

### 7D — Staff Attendance (brief)

**Path:** `/admin/staff/attendance`

- Biometric device integration, daily/monthly registers
- "Same platform tracks student and staff attendance — HR payroll can use staff registers."

---

## Section 8 — Faculty portal live demo (5 minutes)

**Log out admin → Log in as faculty**

| Field    | Value                    |
| -------- | ------------------------ |
| Tenant   | `demo`                   |
| Email    | `francis.momin@demo.edu` |
| Password | `Faculty@123`            |

### Walkthrough

1. **Staff Dashboard** — today's classes, notifications
2. **My Subjects / Teaching Load** — assigned courses
3. **Timetable** — personal weekly schedule
4. **LMS Workspace** — post material or assignment (show UI even if empty)
5. **Attendance Entry** — mark today's class
6. **Marks Entry** — enter internal assessment marks
7. **My Profile / Leave** — self-service HR

### Talking points

- "Faculty do not need admin login — they work in their own simplified portal."
- "Attendance and marks entry happen where teaching happens — not on paper registers later."
- "Leave and payslips are self-service — less burden on admin office."

---

## Section 9 — Examinations & certificates (4 minutes)

### Examinations

**Path:** `/admin/academics/examinations`

- Exam schedules, hall tickets, result processing

### Certificates

**Path:** `/admin/certificates`

1. Templates and visual designer
2. Student **requests** (from portal) → approval workflow
3. **Verification** page — public URL to verify certificate authenticity
4. Bulk issue for convocation batches

### Talking points

- "Bonafide, transfer, character certificates — templated, tracked, verifiable online."
- "Reduces manual typing and seal-and-sign bottlenecks before NAAC visits."

---

## Section 10 — Finance & library (5 minutes)

### Finance

**Path:** `/admin/fees`

| Feature                | Benefit                                   |
| ---------------------- | ----------------------------------------- |
| Fee structure studio   | Programme-wise, shift-wise fee heads      |
| Demand generator       | Auto-generate term fees for all students  |
| Payment desk           | Counter collection with receipt           |
| Student ledger         | Full transaction history per student      |
| Defaulter intelligence | Who owes what — filter by programme/shift |
| Scholarships           | Concession rules applied automatically    |
| Day closing            | Cash register reconciliation              |

**Role demo (optional):** Log in as `accounts@demo.edu` / `Admin@123`

### Library

**Path:** `/admin/library`

- Catalogue, circulation, reservations, digital library
- Access desk for gate entry logging
- "Library usage feeds institutional reports for NAAC Criterion 4."

---

## Section 10b — Principal Command Center (5 minutes)

**Login:** `principal-desk@demo.edu` / `Admin@123` → lands on `/principal-desk`

| Step | Action                                 | What to highlight                                                                                 |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | Open Principal Desk homepage           | Today's snapshot: students/staff present, defaulters, library overdue, pending leave              |
| 2    | **Scan student ID** in Student Scanner | Full command card in one screen: attendance meter, admit eligibility, monthly fees, library fines |
| 3    | Switch to **Staff Scanner**            | Today's timetable, attendance summary, committee memberships                                      |
| 4    | Open **Leave Approvals**               | Approve staff or student leave without opening HR module                                          |
| 5    | Open **NAAC Readiness**                | Criteria-wise readiness score from one dashboard                                                  |
| 6    | Open **Committee Monitor**             | ICC, IQAC, Anti-Ragging — meetings and pending ATR                                                |

**Talking points:**

- "The Principal never opens ten menus — scan any student or staff ID and see everything in under one second."
- "Admit card eligibility is computed live: attendance ≥ 75% and no fee dues."
- "Leave, committees, fees, and NAAC alerts are actionable from one command center."

---

#### Library Gate Kiosk (live demo — 3 minutes)

**Login:** `library-desk@demo.edu` / `Admin@123` → redirects to `/library-desk`

| Step | Action                                             | What to highlight                                                      |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | Open kiosk on a **second monitor** near the gate   | Click **Kiosk Mode** (fullscreen)                                      |
| 2    | Scan student ID barcode (USB scanner auto-submits) | Animated scanner: idle → detecting → verifying → **ENTRY ALLOWED**     |
| 3    | Scan same card again                               | **EXIT RECORDED** with session duration                                |
| 4    | Point at **Librarian verify** strip                | Membership, attendance %, fee status, loans, fines — no blocking popup |
| 5    | Show **live side panel**                           | Occupancy, gender split, recent activity, notice board                 |
| 6    | **Visitor Pass**                                   | Register Parent/Guest/Alumni — auto check-in                           |

**Talking points:**

- "Scanner never blocks the queue — next student can scan while the welcome screen is still showing."
- "Librarian sees fee and attendance flags instantly without opening the student profile."
- "Real-time occupancy updates via WebSocket — no page refresh."

---

## Section 11 — Campus operations (6 minutes)

### Infrastructure

**Path:** `/admin/organization/infrastructure`

- Buildings → floors → rooms → labs
- Room calendar and availability for events/exams

### Front Office

**Path:** `/admin/front-office`

- Enquiries, gate passes, complaints, kiosk desk

### Governance & Committees

**Path:** `/admin/governance`

1. **Committee Master** — IQAC, Anti-Ragging, ICC/POSH, Examination, etc.
2. **Committee Members** (`/admin/governance/members`) — full roster with member types
3. **Meetings** — schedule, minutes, attendance
4. **Action Taken Reports (ATR)** — follow-up tracking
5. **Notices** — publish to staff/student portals

#### Committee Members demo (NAAC-focused — 4 minutes)

**Path:** `/admin/governance/members`

| Member type                              | Example use                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Internal Staff**                       | Search staff directory — auto-loads designation, dept, mobile                             |
| **External Member**                      | ICC advocate, NGO rep — manual name, org, expertise                                       |
| **Ex-Officio**                           | Principal, IQAC Coordinator — **position-based**, auto-updates when office holder changes |
| **Student / Alumni / Parent / Industry** | Representatives per statutory committee rules                                             |

**Demo flow:**

1. Select **Internal Complaints Committee (ICC)** from filter
2. Show **Composition dashboard** — internal vs external counts
3. Show **NAAC compliance panel** — external member present, female presiding officer, minimum members
4. Add an **External Member** (advocate) — fields: name, designation, organization
5. Add **Ex-Officio → Principal** — system resolves current Principal automatically
6. Open **History** — tenure retained when member is replaced (REPLACED status, not deleted)
7. **Download Excel template** — bulk import from committee PDF rosters

### Talking points

- "ICC requires external members and a female presiding officer — the system validates composition for NAAC."
- "When the Principal changes, ex-officio committees update without manual roster correction."
- "Committee work is usually lost in register books — here it is searchable and reportable."
- "NAAC assessors ask for IQAC meeting minutes — we produce them from this module."

### NAAC & IQAC

**Path:** `/admin/naac`

- Criteria dashboard, evidence repository, AQAR, DVV readiness
- Department portals for collecting proofs from each HOD
- Faculty/student achievement registers, MoU tracking

### Transport & Inventory (brief)

- **Transport:** routes, vehicles, student seat assignments
- **Inventory:** stores, stock, issue/return, purchase orders

---

## Section 12 — Student portal live demo (5 minutes)

**Log out → Log in as student**

| Field    | Value                       |
| -------- | --------------------------- |
| Tenant   | `demo`                      |
| Email    | `demo.student.001@demo.edu` |
| Password | `Student@123`               |

### Walkthrough

1. **Student Dashboard** — announcements, quick links
2. **Registration** — FYUGP semester course selection (if window open)
3. **Timetable** — personal class schedule
4. **LMS** — subject materials and assignments
5. **Fees** — outstanding balance, payment history
6. **Results** — published grades
7. **Attendance** — subject-wise percentage
8. **Certificates** — request bonafide online
9. **Profile → ABC ID** — view/update (if enabled)
10. **Governance notices** — committee circulars

### Talking points

- "Students get transparency — fees, attendance, results, timetable in one app."
- "Semester registration enforces NEP rules — students cannot pick invalid combinations."
- "ABC ID self-service reduces admin data-entry load."

---

## Section 13 — Reports, security & administration (4 minutes)

### Reports hub

**Path:** `/admin/reports`

- Student demographic, admission register, government reports (AISHE-ready exports)
- Fee outstanding, attendance defaulters, compliance reports
- ABC coverage (also under student reports)

### Administration & security

**Path:** `/admin/administration`

- **Roles & Permissions** — granular access (show one example: librarian vs registrar)
- **Audit logs** — who changed what and when
- **Theme Studio** — college logo and colors
- **Backup & DR Center** — scheduled backups, restore procedures

### Talking points

- "Principal can delegate module access without sharing one super-password."
- "Audit trail protects against unauthorized grade or fee changes."
- "Backups are built-in — not an afterthought."

---

## Section 14 — Technology & deployment (3 minutes)

_Use this section if Principal or IT staff ask "what is it built on?"_

### Stack summary (plain language)

| Layer         | Technology         | Why it matters                             |
| ------------- | ------------------ | ------------------------------------------ |
| Web interface | Next.js + React    | Fast, modern, works on any browser         |
| Server        | NestJS (Node.js)   | Modular, maintainable, well-documented API |
| Database      | PostgreSQL 16      | Reliable, industry-standard for ERP        |
| Cache/queues  | Redis + BullMQ     | Handles bulk imports and notifications     |
| Real-time     | Socket.IO          | Live updates without page refresh          |
| Security      | JWT + RBAC + audit | Enterprise-grade access control            |

### Architecture highlights

- **Multi-tenant SaaS** — one installation can serve multiple colleges (tenant `demo` is ours)
- **API-first** — mobile apps and integrations can connect later
- **Swagger docs** at `/docs` for developers
- **Cloud-ready** — AWS S3 storage, deployable on AWS/Azure/DigitalOcean

Full details: [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) · [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Section 15 — Closing & Q&A (5 minutes)

### Summary script

> "In summary, BCL OneCampus gives us:
>
> 1. **End-to-end student journey** — admission to alumni
> 2. **NEP-2020 compliance** — FYUGP registration, ABC IDs, CBCS credits
> 3. **Operational efficiency** — timetable, fees, HR, library in one place
> 4. **Governance & NAAC readiness** — committees, evidence, AQAR
> 5. **Role-based portals** — admin, faculty, student each see what they need
>
> Next steps we recommend: pilot with one department, train key users, go live department-by-department."

### Common questions & answers

| Question                      | Answer                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Can we use our existing data? | Yes — bulk import for students, staff, courses, timetable                      |
| What about our shift system?  | Built-in shift management with shift-scoped admins                             |
| Is it NAAC ready?             | Evidence repository, IQAC activities, governance minutes, AQAR module          |
| Mobile app?                   | Responsive web today; mobile app control panel prepared for future native apps |
| Offline?                      | Web-based; biometric devices sync attendance when online                       |
| Data security?                | Role-based access, audit logs, encrypted passwords, tenant isolation           |
| Who maintains it?             | Internal IT with vendor support; backup/restore built into admin               |

---

## Short demo path (25 minutes)

If time is limited, follow this condensed route:

| Min | Section                             | Path                               |
| --- | ----------------------------------- | ---------------------------------- |
| 2   | Login + Dashboard                   | `/admin`                           |
| 3   | Admissions → one admitted student   | `/admin/admissions`                |
| 4   | Student profile + ABC ID            | `/admin/students`                  |
| 4   | Academic Engine registration window | `/admin/academic-engine`           |
| 3   | Timetable published view            | `/admin/academics/timetable`       |
| 3   | Faculty portal — attendance + marks | `/staff` (faculty login)           |
| 3   | Fees dashboard + defaulters         | `/admin/fees`                      |
| 3   | Governance + NAAC dashboard         | `/admin/governance`, `/admin/naac` |
| 2   | Student portal quick tour           | `/student` (student login)         |
| 2   | Close + Q&A                         | —                                  |

---

## Appendix A — Full admin menu map

Use this as a reference card during demo.

### Core

- Dashboard · Institution Analytics
- Admissions (11 sub-pages)
- Students (18+ sub-pages including ABC upload)
- Academics (programmes, engine, lifecycle, shifts)

### People

- Staff · ID Cards · HR/Payroll (20+ sub-pages)

### Teaching & Learning

- Timetable · LMS · Question Bank · Student Attendance · Staff Attendance

### Examination & Results

- Examinations · Certificates

### Finance & Library

- Finance (18+ sub-pages) · Library (12 sub-pages)

### Campus Operations

- Infrastructure · Front Office · Governance · NAAC/IQAC · Communication · Transport · Inventory

### Analytics & System

- Reports · Administration · Backup & DR · Settings

---

## Appendix B — Specialized role logins

| Role                | Email                     | Password    | Start page              |
| ------------------- | ------------------------- | ----------- | ----------------------- |
| Principal desk      | `principal-desk@demo.edu` | `Admin@123` | `/principal-desk`       |
| Librarian           | `librarian@demo.edu`      | `Admin@123` | `/admin/library`        |
| Library gate kiosk  | `library-desk@demo.edu`   | `Admin@123` | `/library-desk`         |
| Accountant          | `accounts@demo.edu`       | `Admin@123` | `/admin/fees`           |
| Front office        | `frontoffice@demo.edu`    | `Admin@123` | `/admin/front-office`   |
| Transport           | `transport@demo.edu`      | `Admin@123` | `/admin/transport`      |
| Store keeper        | `store@demo.edu`          | `Admin@123` | `/admin/inventory`      |
| Morning shift admin | `morning.admin@demo.edu`  | `Shift@123` | `/admin` (shift-scoped) |

---

## Appendix C — Demo troubleshooting

| Issue                        | Fix                                                                        |
| ---------------------------- | -------------------------------------------------------------------------- |
| Login fails                  | Confirm tenant slug `demo`; re-run `npm run db:seed`                       |
| Empty dropdowns / 400 errors | Restart API; confirm migrations applied                                    |
| Port in use                  | Run `npm run dev:clean`                                                    |
| Faculty/student login fails  | Run timetable foundation seed if demo users missing                        |
| Slow page load               | First load after seed is normal; subsequent pages cache via TanStack Query |

---

## Appendix D — Suggested handouts for Principal

1. One-page **module checklist** (Appendix A above)
2. **Demo credentials card** (login table from top of script)
3. Link to [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) for technical appendix
4. **Implementation timeline** (your institution's rollout plan — customize locally)

---

_Demo script aligned with navigation in `apps/web/config/navigation.ts`. Update when menus change._
