# NEP-2020 College ERP — Project Overview

**Product name:** BCL OneCampus (NEP-2020 College ERP)  
**Version:** 0.1.0 (active development)  
**Audience:** Principals, administrators, IT teams, implementation partners

---

## 1. Executive summary

BCL OneCampus is a **SaaS multi-tenant College/University ERP** designed for Indian higher-education institutions. It unifies admissions, student lifecycle, academics, examinations, finance, HR, governance, and accreditation workflows in a single platform.

The system is explicitly aligned with:

| Framework                          | How the ERP supports it                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **NEP-2020 / FYUGP**               | Four-year undergraduate structure, semester rules, major/minor/MDC/AEC/SEC/VAC categories, semester registration with FCFS seat allocation |
| **CBCS**                           | Credit-based course structure, curriculum mapping, subject registration, credit ledger                                                     |
| **OBE**                            | Outcome-based education hooks via curriculum and examination modules                                                                       |
| **ABC (Academic Bank of Credits)** | ABC ID capture at admission, profile, bulk upload, coverage reports, optional portal self-update                                           |
| **NAAC / IQAC**                    | Criteria tracking, evidence repository, AQAR, DVV readiness, governance committee evidence                                                 |

**Target users:** College Principal, Registrar, Deans/HODs, faculty, non-teaching staff, students, parents, accountants, librarians, and specialized desk roles (front office, transport, store).

**Deployment model:** Monorepo with separate Web, API, and Worker processes; PostgreSQL multi-schema database; Redis for queues and real-time scaling; suitable for on-premise, cloud VM, or managed-DB production setups.

---

## 2. System architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browsers / Mobile (future)                                      │
│  Admin · Staff/Faculty · Student · Parent · Public verify pages  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│  Next.js 15 Web App (apps/web) — port 3000                       │
│  React 19 · TanStack Query · Tailwind 4 · Socket.IO client       │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│  NestJS 11 API (apps/api) — port 3001, prefix /api               │
│  Modular monolith · JWT auth · CASL RBAC · Swagger /docs         │
└──────┬──────────────────────────────┬─────────────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────┐              ┌──────────────────┐
│ PostgreSQL 16│              │ Redis 7           │
│ Multi-schema │              │ BullMQ · Socket.IO│
└──────────────┘              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ Worker (apps/worker)│
                              │ Background jobs     │
                              └───────────────────┘
```

### 2.1 Monorepo layout

| App        | Path          | Role                                                            |
| ---------- | ------------- | --------------------------------------------------------------- |
| **Web**    | `apps/web`    | Admin, staff, student, and parent dashboards; admission portal  |
| **API**    | `apps/api`    | REST API, WebSockets, business logic, Prisma ORM                |
| **Worker** | `apps/worker` | BullMQ job processor (reports, imports, notifications, backups) |

Managed with **npm workspaces** and **Turborepo** (`turbo dev`, `turbo build`).

### 2.2 Database design

PostgreSQL uses **logical schemas** for domain separation:

- `platform` — tenants, users, licensing, sessions
- `core` — organization, staff, students, master data
- `academic` — programmes, timetable, LMS, examinations, attendance
- `finance` — fees, ledger, scholarships
- `compliance` — ABC accounts, NAAC evidence, governance records

Every business table is **tenant-scoped** via `tenant_id`. API requests include tenant context through the `X-Tenant-Slug` header (e.g. `demo`).

### 2.3 Security model

- **Authentication:** JWT access tokens + rotating refresh tokens (httpOnly cookies)
- **Authorization:** Fine-grained RBAC with 100+ permission slugs (e.g. `students:manage`, `payroll:process`, `governance:publish`)
- **Ability layer:** CASL (`@casl/ability`) for server-side policy checks
- **Audit:** Audit logs on sensitive student, staff, certificate, and attendance operations
- **Rate limiting:** NestJS Throttler on public endpoints
- **Headers:** Helmet for HTTP security headers

See also: [SECURITY-AUDIT-RBAC.md](./SECURITY-AUDIT-RBAC.md)

### 2.4 Real-time & background processing

- **Socket.IO** with Redis adapter for live notifications and attendance updates
- **BullMQ** queues for bulk imports, PDF generation, email, backup jobs
- **Scheduled tasks** via `@nestjs/schedule` (cron-style maintenance)

### 2.5 File & document storage

- Local uploads under `apps/api/uploads` and `apps/api/storage` (dev)
- **AWS S3** SDK integration for production object storage
- **Puppeteer** + **Sharp** for PDF/image generation (certificates, ID cards, reports)
- **ExcelJS** for import/export templates

---

## 3. Technology stack

### 3.1 Frontend (`apps/web`)

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| Framework       | Next.js 15.5 (App Router)              |
| UI library      | React 19                               |
| Styling         | Tailwind CSS 4                         |
| Components      | Radix UI primitives, Lucide icons      |
| Forms           | React Hook Form + Zod 4                |
| Data fetching   | TanStack Query 5, Axios                |
| State           | Zustand                                |
| Charts          | Recharts                               |
| Real-time       | socket.io-client 4                     |
| Animation       | Framer Motion                          |
| Virtualization  | TanStack Virtual (large student lists) |
| Command palette | cmdk (global search)                   |

### 3.2 Backend (`apps/api`)

| Layer       | Technology                             |
| ----------- | -------------------------------------- |
| Framework   | NestJS 11                              |
| ORM         | Prisma 6                               |
| Validation  | class-validator, class-transformer     |
| Auth        | Passport JWT, bcrypt                   |
| API docs    | Swagger (`/docs`)                      |
| Queues      | BullMQ + ioredis                       |
| Email       | Nodemailer                             |
| Biometric   | node-zklib (ZKTeco device integration) |
| PDF parsing | pdf-parse                              |
| Testing     | Jest, Supertest                        |

### 3.3 Infrastructure

| Component      | Version / notes                                                        |
| -------------- | ---------------------------------------------------------------------- |
| PostgreSQL     | 16 (Docker; host port **15432** on Windows to avoid local PG conflict) |
| Redis          | 7                                                                      |
| Node.js        | 20+ recommended                                                        |
| Docker Compose | postgres + redis for local dev                                         |
| CI quality     | Husky, lint-staged, Prettier, Commitlint                               |

### 3.4 API modules (backend)

The NestJS API is organized into **40+ domain modules**, including:

`academic-engine`, `academic-lifecycle`, `accommodation`, `administration`, `admissions`, `auth`, `backup-engine`, `branding`, `certificates`, `communication`, `curriculum-core`, `dashboard-analytics`, `examinations`, `faculty-shifts`, `fees`, `front-office`, `governance`, `hr`, `id-cards`, `infrastructure`, `inventory`, `library`, `licensing`, `lms`, `loans`, `master-data`, `mobile-app`, `naac-iqac`, `nep-abc`, `obe`, `organization`, `payroll`, `programs-courses`, `question-bank`, `realtime`, `reports`, `shift-operations`, `shifts`, `staff`, `staff-attendance`, `student-attendance`, `student-reports`, `students`, `support-data`, `tenants`, `timetable-engine`, `transport`, `users`

Each module typically contains controllers, services, DTOs, and Prisma queries scoped to its domain.

---

## 4. User portals & roles

### 4.1 Admin portal (`/admin`)

Full institutional control. Used by Principal, Registrar, system administrators, and module owners. Navigation is permission-gated — users only see modules they are authorized for.

### 4.2 Staff / Faculty portal (`/staff`)

Teaching and operational workspace:

- Academic: subjects, teaching load, timetable, LMS, question bank, examinations, marks, attendance entry
- HR self-service: profile, leave, salary slips, documents
- Communication: announcements, messages, circulars, events
- Administration: approvals, department tasks, committee membership, NAAC contributions

### 4.3 Student portal (`/student`)

Self-service for enrolled students:

- Dashboard, results, fees, certificates, timetable
- LMS, question bank, library
- Semester registration (FYUGP / academic engine)
- Attendance, examinations
- Governance notices and committee meetings
- ABC ID view/update (when enabled)

### 4.4 Specialized role shortcuts

| Role                  | Primary entry         |
| --------------------- | --------------------- |
| Accountant            | `/admin/fees`         |
| Librarian             | `/admin/library`      |
| Front office desk     | `/admin/front-office` |
| Transport coordinator | `/admin/transport`    |
| Store keeper          | `/admin/inventory`    |
| Parent                | `/parent` (dashboard) |

### 4.5 Shift administration

Multi-shift colleges (Morning / Day / Evening) have dedicated shift-admin users with scoped visibility. See [SHIFT_ADMINISTRATION.md](./SHIFT_ADMINISTRATION.md).

---

## 5. Module catalog

Below is a functional catalog aligned with the admin navigation. Each module includes its primary capabilities.

### 5.1 Core operations

#### Dashboard & Analytics

- Institution KPI dashboard
- Cross-module analytics (`/admin/analytics`)
- Command palette global search (students by name, roll, enrollment, ABC ID)

#### Admissions

- Application control center and configurable application forms
- Document verification, payment verification, admission fee verification
- Merit lists and selection workflows
- Admitted students pipeline → student records
- Intakes, admission cycles, analytics, archive

#### Students

- Student directory with advanced filters (including ABC status)
- Add student, bulk import/export/update, bulk photo upload
- **ABC ID:** upload center, coverage in reports, profile & portal integration
- Subject registration, RFID management
- Semester promotion, transfer, archive, re-admission
- Student communication and audit logs

#### Academics

- Programmes & courses (`/admin/programs`)
- **Academic Engine** — FYUGP structure, offerings, registration windows ([ACADEMIC_ENGINE.md](./ACADEMIC_ENGINE.md))
- Curriculum mapping and setup completion
- Academic sessions and semester lifecycle ([ACADEMIC_LIFECYCLE.md](./ACADEMIC_LIFECYCLE.md))
- Shift management ([SHIFT_ADMINISTRATION.md](./SHIFT_ADMINISTRATION.md))

### 5.2 People management

#### Staff

- Staff directory, add/import/bulk update
- Teaching assignments, portal user provisioning
- Roles, reports, audit logs

#### Identity & ID Cards

- Template gallery and visual card designer
- Student and staff card production, bulk generation
- Print queue, RFID mapping, reissue
- Public verification portal

#### Human Resources & Payroll

- Departments, designations, recruitment
- Staff attendance integration, leave, substitute staff
- Salary components, pay structures, assignments, revisions, increments
- Payroll runs, loans & advances, accommodation
- PF/CPF/NPS, pension, payslips, performance appraisal
- Faculty workload reports

### 5.3 Teaching & learning

#### Timetable

- Plans, subject groups, teaching allocation
- Bulk import/export, validation center
- **Generation engine**, conflict resolution, draft review, publish
- Reports and settings

#### LMS (Learning Management System)

- Subject workspaces per offering
- Learning materials, assignments, quizzes, discussions
- Lesson plans and module settings

#### Question Bank

- Previous year papers, upload center
- Faculty contribution workspace
- Approval workflow, student access control, reports

#### Student Attendance

- Session-wise attendance, defaulter tracking
- Integration with timetable and registration

#### Staff Attendance

- Live attendance, biometric device admin (ZKTeco)
- Pull logs, processing pipeline
- Daily/monthly registers, settings, audit

### 5.4 Examination & results

#### Examinations

- Examination scheduling and management
- Marks entry (staff portal), result processing

#### Certificates

- Template designer, certificate generator
- Student requests, bulk issue, verification
- Approval workflow, analytics, audit

### 5.5 Finance & library

#### Finance (Fees)

- Fee dashboard, admission/monthly fee structures
- Fee heads, cycles, demand generator
- Payment desk, external payments, cash register, day closing
- Scholarships & concessions, student ledger explorer
- Defaulter intelligence, renewal center, financial reports

#### Library

- Access desk, catalogue, circulation, reservations
- Visitors, digital library, research repository
- Search, analytics, reports, settings

### 5.6 Campus operations

#### Infrastructure

- Buildings, floors, rooms, labs, shared halls
- Room calendar, availability, import/export

#### Front Office

- Enquiries, gate passes, kiosk desk, complaints

#### Governance & Committees

- Committee master, members, meetings, calendar
- Action Taken Reports (ATR), attendance, tasks
- Notices, documents, events, NAAC evidence linkage

#### NAAC & IQAC

- Criteria & metrics, evidence repository, document vault
- AQAR management, department portal
- Faculty/student achievements, MoUs, IQAC activities
- DVV readiness, NAAC calendar, reports

#### Communication

- Communication center, student remarks

#### Transport

- Routes & stops, vehicles, student assignments, capacity alerts

#### Inventory

- Stores, items & stock, issue/return
- Vendors, purchase orders, barcode labels
- Requisitions, restock suggestions

### 5.7 Analytics & reporting

#### Reports hub

- Student reports: admission, academic, demographic, department, contact, government
- Export center, admission register
- Attendance defaulters, fee outstanding, compliance reports
- Cross-links to module-specific report pages

### 5.8 System administration

#### Administration

- Portal users, roles & permissions, user activation
- Support data (lookups), roll number settings
- Security & sessions, audit logs, license management
- Theme Studio (branding), mobile app control
- Import/export center

#### Backup & DR

- Backup schedule, repository, restore center

#### Settings

- Organization profile and configuration

---

## 6. NEP / compliance highlights

### 6.1 Academic Engine (FYUGP)

Semesters 1–3 support:

- Course categories: MAJOR, MINOR, MDC, AEC, SEC, VAC, VTC
- Student academic profile with Class 12 subject mapping
- Registration windows with FCFS seat allocation and waitlists
- Validation: MDC conflict rules, continuity locks, structure counts, AEC language eligibility
- Credit ledger on confirmed registration

Detailed guide: [ACADEMIC_ENGINE.md](./ACADEMIC_ENGINE.md)

### 6.2 ABC (Academic Bank of Credits)

- Stored on dedicated `AbcAccount` compliance record per student
- Captured at admission, visible in directory/profile/portal
- Bulk upload by roll number with template download
- Coverage dashboard and filters (`verified`, `pending`, `missing`)
- Optional student self-update via portal (tenant-configurable)
- Global search includes ABC ID lookup

### 6.3 NAAC / IQAC workflow

- Structured criteria and metric tracking
- Central evidence repository with department collection portals
- AQAR preparation, DVV readiness checklist
- Governance module feeds committee meeting evidence into NAAC bundle

### 6.4 OBE & curriculum

- Curriculum core module maps programmes to outcomes
- Course delivery documentation: [COURSE_DELIVERY.md](./COURSE_DELIVERY.md), [COURSE_IMPORT.md](./COURSE_IMPORT.md)
- Academic streams: [ACADEMIC_STREAMS.md](./ACADEMIC_STREAMS.md)

---

## 7. Development & operations

### 7.1 Quick start

```bash
docker compose up -d postgres redis
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

| Service | URL                        |
| ------- | -------------------------- |
| Web     | http://localhost:3000      |
| API     | http://localhost:3001/api  |
| Swagger | http://localhost:3001/docs |

**Demo login:** tenant `demo` · email `admin@demo.edu` · password `Admin@123`

If Prisma authentication fails on Windows (local PostgreSQL on 5432), use Docker Postgres on port **15432** — see [README.md](../README.md).

### 7.2 Useful commands

| Command                   | Purpose                              |
| ------------------------- | ------------------------------------ |
| `npm run dev:clean`       | Free ports 3000/3001 and restart dev |
| `npm run db:studio`       | Prisma Studio (API workspace)        |
| `npm run typecheck`       | TypeScript check all apps            |
| `npm run load:test:smoke` | k6 smoke load test                   |

API includes domain-specific verify scripts (e.g. `verify:naac-iqac`, `verify:library-phase4`).

### 7.3 Production deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for AWS/Azure/DigitalOcean guidance, Nginx reverse proxy, external managed PostgreSQL, and subdomain routing (ERP vs admission portal).

### 7.4 Migration between machines

Use the migration pack scripts:

- `scripts/create-migration-pack.ps1` — bundles DB, uploads, env templates, chat history
- `scripts/restore-migration-pack.ps1` — restores on new system

Pack includes `RESTORE_ON_NEW_SYSTEM.md` with step-by-step instructions.

---

## 8. Demo credentials reference

| Role           | Tenant | Email                       | Password      | Notes                           |
| -------------- | ------ | --------------------------- | ------------- | ------------------------------- |
| Super Admin    | `demo` | `admin@demo.edu`            | `Admin@123`   | Full admin access               |
| Faculty (seed) | `demo` | `francis.momin@demo.edu`    | `Faculty@123` | After timetable foundation seed |
| Student (seed) | `demo` | `demo.student.001@demo.edu` | `Student@123` | After timetable foundation seed |
| Librarian      | `demo` | `librarian@demo.edu`        | `Admin@123`   | Library desk                    |
| Accountant     | `demo` | `accounts@demo.edu`         | `Admin@123`   | Fee module                      |
| Front office   | `demo` | `frontoffice@demo.edu`      | `Admin@123`   | Front office desk               |
| Transport      | `demo` | `transport@demo.edu`        | `Admin@123`   | Transport module                |
| Store keeper   | `demo` | `store@demo.edu`            | `Admin@123`   | Inventory module                |
| Shift admin    | `demo` | `morning.admin@demo.edu`    | `Shift@123`   | Morning shift scope             |

New students created via admin default to password `Student@123` unless overridden.

---

## 9. Related documentation

| Document                                             | Topic                                           |
| ---------------------------------------------------- | ----------------------------------------------- |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)                   | Step-by-step presentation for Principal & staff |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                     | Production deployment                           |
| [ACADEMIC_ENGINE.md](./ACADEMIC_ENGINE.md)           | FYUGP registration engine                       |
| [ACADEMIC_LIFECYCLE.md](./ACADEMIC_LIFECYCLE.md)     | Sessions and semesters                          |
| [ACADEMIC_STREAMS.md](./ACADEMIC_STREAMS.md)         | Programme streams                               |
| [SHIFT_ADMINISTRATION.md](./SHIFT_ADMINISTRATION.md) | Multi-shift colleges                            |
| [SECURITY-AUDIT-RBAC.md](./SECURITY-AUDIT-RBAC.md)   | Permissions model                               |
| [COURSE_DELIVERY.md](./COURSE_DELIVERY.md)           | Course delivery workflows                       |
| [COURSE_IMPORT.md](./COURSE_IMPORT.md)               | Bulk course import                              |

---

## 10. Roadmap notes (in development)

Features marked **soon** or documented as Phase 2+ in technical docs:

- Advanced analytics dashboard (nav badge: soon)
- Academic Engine semesters 4–8, GPA/CGPA automation
- AI-assisted timetable and registration recommendations
- Native mobile apps (mobile app control panel exists in admin)

---

_Document generated from codebase navigation, README, and module inventory. Update this file when major modules ship or navigation changes._
