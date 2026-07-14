# Shift-based academic administration

Centralized academic definition with decentralized per-shift operations.

## Architecture

| Layer    | Scope       | Examples                                                           |
| -------- | ----------- | ------------------------------------------------------------------ |
| Central  | Institution | Programmes, curriculum, courses, academic years, shift CRUD        |
| Delivery | Shift       | Offering sections, faculty, timetable, attendance, exams, students |

Shifts live in `core.shifts` (campus-scoped, database-driven — not hardcoded Morning/Day/Evening).

### Workspace model (admin UI)

Morning and Day operate as **persistent admin workspaces**, not per-page filters:

| Workspace   | Code      | Who enters                            | Accent  |
| ----------- | --------- | ------------------------------------- | ------- |
| Institution | —         | Super Admin, Principal (consolidated) | Default |
| Morning     | `MORNING` | Morning shift admin                   | Teal    |
| Day         | `DAY`     | Day shift admin                       | Amber   |

- Same `/admin/*` routes — workspace context injects `x-shift-id` on API calls
- Super admin: last workspace remembered; picker at `/admin/workspace` on first login
- Shift admins: workspace locked to assigned shift; no shift dropdown on student directory
- Shared modules (Library, HR, Principal desk, global course master) ignore workspace filter

## RBAC

| Role                            | Access                                    |
| ------------------------------- | ----------------------------------------- |
| `college-admin`                 | All shifts (`allShifts: true`)            |
| `shift-admin`                   | Assigned shifts via `UserShiftAssignment` |
| `shift-academic-coordinator`    | Students + academic engine in shift       |
| `shift-attendance-manager`      | Attendance in shift                       |
| `shift-examination-coordinator` | Exams in shift                            |

JWT claims: `shiftIds`, `primaryShiftId`, `allShifts`.

### Role entry matrix

| Role                  | JWT                       | Workspace         | Switcher | Default landing                   |
| --------------------- | ------------------------- | ----------------- | -------- | --------------------------------- |
| Super Admin           | `allShifts: true`         | Any + institution | Yes      | `/admin` (last workspace)         |
| Morning Admin         | `shiftIds: [morning]`     | `morning` only    | No       | `/admin`                          |
| Day Admin             | `shiftIds: [day]`         | `day` only        | No       | `/admin`                          |
| Faculty (one shift)   | N/A                       | N/A               | No       | `/staff/dashboard`                |
| Faculty (both shifts) | `StaffShiftAssignment` ×2 | N/A               | No       | Merged timetable with shift badge |

## API

| Method          | Path                                    | Notes                                                      |
| --------------- | --------------------------------------- | ---------------------------------------------------------- |
| CRUD            | `/api/v1/shifts`                        | Institution + campus scoped                                |
| POST            | `/api/v1/shifts/:id/activate`           | Set ACTIVE                                                 |
| POST            | `/api/v1/shifts/:id/deactivate`         | Set INACTIVE                                               |
| POST            | `/api/v1/shifts/reorder`                | Batch `sortOrder`                                          |
| GET             | `/api/v1/shifts/operations/summary`     | Shift admin dashboard                                      |
| GET/POST/DELETE | `/api/v1/shifts/:id/admins`             | User shift assignments                                     |
| POST            | `/api/v1/shifts/:id/admins/by-email`    | Assign by email; optional create user + `shift-admin` role |
| GET             | `/api/v1/shifts/admin-users`            | Search tenant users (picker)                               |
| GET/POST        | `/api/v1/faculty-shifts`                | Faculty ↔ shift mapping                                    |
| GET/POST        | `/api/v1/shift-operations/timetable`    | Shift-scoped timetable MVP                                 |
| GET/POST        | `/api/v1/shift-operations/attendance`   | Attendance sessions                                        |
| GET/POST        | `/api/v1/shift-operations/examinations` | Exam schedules                                             |

All workspace-scoped admin modules honor the `x-shift-id` header (auto-sent by the web client when workspace ≠ institution). Shift-only users receive 403 if the header is tampered.

## Ownership model (Option A)

Each shift admin manages **only their own shift**:

| Role                        | Can manage                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| Morning Shift Admin         | Morning timetable, Morning faculty allocation, Morning attendance |
| Day Shift Admin             | Day timetable, Day faculty allocation, Day attendance             |
| College / Institution admin | All shifts (`allShifts: true`)                                    |

Option B (both admins assigning across shifts) is **not** supported. Cross-shift faculty teaching uses a **single** `StaffProfile` with multiple `StaffShiftAssignment` rows — never duplicate staff records.

## Cross-shift faculty clash

When validating or saving timetable plans, the conflict engine detects **wall-clock overlaps** for the same faculty across Morning and Day (or any other shifts):

- Conflict type: `CROSS_SHIFT_FACULTY_CLASH`
- Example: Morning 09:00–09:50 vs Day 09:45–10:40 for the same teacher → warning on validate/publish
- Faculty portal **Today’s Classes** and week matrix remain combined (no Morning/Day portal switch)

## Staff visibility badges

Faculty pickers (shift roster, candidates, timetable slot modal) show assigned-shift chips (`Morning` / `Day`) so admins see who teaches one or both shifts.

## Shift reports pack

| Route / API                            | Content                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/admin/academics/shift-reports`       | Workspace UI                                                                                                      |
| `GET /api/v1/reports/shift-operations` | Faculty workload, subject allocation, timetable coverage, classroom utilization, teaching hours, department staff |

Dashboard `GET /api/v1/shifts/operations/summary` uses batched `groupBy` aggregates (not per-shift N+1 counts).

## Course delivery model

- **Course** — single master catalog row
- **CourseOffering** — program/semester curriculum mapping
- **OfferingSection** — shift delivery (`shiftId`, faculty, capacity, room)

## UI routes

| Route                            | Audience                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| `/admin/workspace`               | Super admin workspace picker (Institution / Morning / Day)        |
| `/admin/shifts`                  | Institution admin — shift CRUD, **shift administrators**, summary |
| `/admin/academics/shift-faculty` | Faculty ↔ shift roster with multi-shift badges                    |
| `/admin/academics/shift-reports` | Shift-wise workload / utilization reports                         |
| `/admin/*`                       | All admin modules — workspace context auto-scopes delivery data   |
| `/shift/*`                       | **Deprecated** — redirects to `/admin` with workspace context     |

### Assigning shift admins (college / super admin)

1. Open **Academics → Shift management** (`/admin/shifts`).
2. Select **Institution** and **Campus**.
3. In **Shift administrators**, choose the shift (e.g. Morning or Day).
4. Enter the user email. For a new account, keep **Create new user** checked and set a password (min 8 characters).
5. Click **Assign shift admin**. The user receives the `shift-admin` role and lands in `/admin` scoped to that shift workspace.

## Demo credentials

After seed:

- `morning.admin@demo.edu` / `Shift@123` — Morning shift admin
- `day.admin@demo.edu` / `Shift@123` — Day shift admin
- `evening.admin@demo.edu` / `Shift@123` — Evening shift admin
- `admin@demo.edu` / `Admin@123` — College admin (all shifts)

## Related

- [ACADEMIC_LIFECYCLE.md](./ACADEMIC_LIFECYCLE.md) — active semester per campus/shift
