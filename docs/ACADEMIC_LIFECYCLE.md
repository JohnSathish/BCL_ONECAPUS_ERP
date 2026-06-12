# Academic lifecycle & promotion engine

Institution-configurable FYUGP academic lifecycle: 3-year / 6-semester calendar, odd/even progression, scoped active semester per campus/shift, and semester promotion (preview, apply, rollback, detain, completion).

## Concepts

| Concept                | Description                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Institution config** | `InstitutionAcademicConfig`: programme model, `maxActiveSemesters`, terminal semester, promotion trigger |
| **Calendar semester**  | Operational `core.semesters` row per academic year (dates, flags, lifecycle status)                      |
| **Program sequence**   | `semesterSequence` 1…N on registrations and student standing                                             |
| **Active semester**    | One operational calendar semester per `(institution, campus, shift)` via `CampusShiftActiveSemester`     |
| **Standing**           | `StudentAcademicStanding`: current sequence, lifecycle state, registration/promotion locks               |

## API (`/api/v1/academic-lifecycle`)

| Method    | Path                                          | Purpose                                                         |
| --------- | --------------------------------------------- | --------------------------------------------------------------- |
| GET/PATCH | `/institutions/:id/academic-config`           | Read/update FYUGP settings                                      |
| POST      | `/institutions/:id/semesters/provision-fyugp` | Create 6 semesters across 3 academic years                      |
| GET       | `/institutions/:id/semesters/structure`       | Year/semester tree for admin UI                                 |
| POST      | `/semesters/:id/activate`                     | Set active per campus/shift; optional promotion preview on EVEN |
| POST      | `/semesters/:id/freeze`                       | Lock semester and module flags                                  |
| GET       | `/promotion-runs/preview`                     | Eligible / detained / failed counts                             |
| POST      | `/promotion-runs`                             | Create DRAFT run from preview                                   |
| POST      | `/promotion-runs/:id/apply`                   | Apply promotion                                                 |
| POST      | `/promotion-runs/:id/rollback`                | Roll back before freeze                                         |
| POST      | `/students/:id/promotion`                     | Individual promote or detain                                    |
| GET       | `/students/:id/promotion-history`             | Audit + progress                                                |

Permissions: `academic-lifecycle:read`, `academic-lifecycle:manage` (seeded on `college-admin`).

## Promotion rules (Phase 1)

- **EVEN activation**: odd→even pairs (1→2, 3→4, 5→6); terminal sem 6 sets `COMPLETED` / alumni-eligible.
- **Eligibility**: prior semester registration `completed`; standing at `fromSequence`; attendance/fees/exams stubbed (`pendingIntegration`).
- **Guards**: no promotion after source semester `FROZEN`; no `toSequence` above institution max; no rollback after freeze.

## Registration integration

`AcademicEngineService.createRegistration`:

- Requires `StudentAcademicStanding` and matching `currentSemesterSequence`.
- Respects institution `maxActiveSemesters` (replaces hard cap of 3).
- Validates active calendar semester for student campus/shift.

On allocation complete, `StudentSemesterProgress` is marked `completed` with earned credits.

## Admin UI

Route: `/admin/academic-lifecycle` — structure tree, provision FYUGP, activate/freeze, promotion preview/apply/rollback.

## Demo seed

Demo tenant uses `FYUGP_3Y_6S`, 6 calendar semesters, rules for sequences 1–6, registration windows 1–6, and initial student standing at semester 1.

## Phase 2 (out of scope)

- Real attendance %, fee clearance, exam clearance in eligibility
- Timetable conflict engine
- PG / 7–8 semester pathways for other institution configs
