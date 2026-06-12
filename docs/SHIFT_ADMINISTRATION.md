# Shift-based academic administration

Centralized academic definition with decentralized per-shift operations.

## Architecture

| Layer    | Scope       | Examples                                                           |
| -------- | ----------- | ------------------------------------------------------------------ |
| Central  | Institution | Programmes, curriculum, courses, academic years, shift CRUD        |
| Delivery | Shift       | Offering sections, faculty, timetable, attendance, exams, students |

Shifts live in `core.shifts` (campus-scoped, database-driven — not hardcoded Morning/Day/Evening).

## RBAC

| Role                            | Access                                    |
| ------------------------------- | ----------------------------------------- |
| `college-admin`                 | All shifts (`allShifts: true`)            |
| `shift-admin`                   | Assigned shifts via `UserShiftAssignment` |
| `shift-academic-coordinator`    | Students + academic engine in shift       |
| `shift-attendance-manager`      | Attendance in shift                       |
| `shift-examination-coordinator` | Exams in shift                            |

JWT claims: `shiftIds`, `primaryShiftId`, `allShifts`.

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

## Course delivery model

- **Course** — single master catalog row
- **CourseOffering** — program/semester curriculum mapping
- **OfferingSection** — shift delivery (`shiftId`, faculty, capacity, room)

## UI routes

| Route           | Audience                                                          |
| --------------- | ----------------------------------------------------------------- |
| `/admin/shifts` | Institution admin — shift CRUD, **shift administrators**, summary |

### Assigning shift admins (college / super admin)

1. Open **Academics → Shift management** (`/admin/shifts`).
2. Select **Institution** and **Campus**.
3. In **Shift administrators**, choose the shift (e.g. Morning or Evening).
4. Enter the user email. For a new account, keep **Create new user** checked and set a password (min 8 characters).
5. Click **Assign shift admin**. The user receives the `shift-admin` role and access only to that shift’s portal (`/shift`).
   | `/shift` | Shift admin dashboard |
   | `/shift/students` | Shift-filtered student list |
   | `/shift/timetable` | Shift timetable |

## Demo credentials

After seed:

- `morning.admin@demo.edu` / `Shift@123` — Morning shift admin
- `day.admin@demo.edu` / `Shift@123` — Day shift admin
- `evening.admin@demo.edu` / `Shift@123` — Evening shift admin
- `admin@demo.edu` / `Admin@123` — College admin (all shifts)

## Related

- [ACADEMIC_LIFECYCLE.md](./ACADEMIC_LIFECYCLE.md) — active semester per campus/shift
