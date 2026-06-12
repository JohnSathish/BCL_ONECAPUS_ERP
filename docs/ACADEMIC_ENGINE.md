# NEP Academic Engine (Phase 1)

BCL OneCampus implements a **NEP-2020 / FYUGP** academic structure engine for semesters **1–3**.

## Features

- FYUGP semester rules (category counts + continuity locks)
- Course categories: MAJOR, MINOR, MDC, AEC, SEC, VAC, VTC
- Student academic profile (Class 12 subjects, language eligibility)
- Major / minor program choices
- Semester registration with validation
- FCFS seat allocation and waitlists
- Credit ledger entries on confirmed registration

## Admin

1. Open **Academics → Academic Engine**
2. Select program version (e.g. BCA v1)
3. **FYUGP structure** — apply default Sem 1–3 rules
4. **Offerings & seats** — adjust capacity per offering
5. **Registration windows** — lock/unlock student registration
6. **Reports** — seat utilization and MDC conflict scan

## Student

1. Log in as student (`rahul.sharma@demo.edu` / `Student@123` after seed)
2. Open **Registration**
3. Select semester, pick one offering per required category
4. Submit — validation runs; seats allocated FCFS

## API

Base path: `/api/v1/academic-engine`

Key endpoints: `summary`, `programs/:id/structure`, `offerings`, `registration-windows`, `registrations/me`, `reports/*`

## Database

Migration: `20250515160000_academic_engine`

After schema changes:

```bash
cd apps/api
npm run dev:free-ports   # from repo root, if API running
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

## Validation rules (Phase 1)

| Rule         | Description                                                |
| ------------ | ---------------------------------------------------------- |
| MDC conflict | MDC must not match major, minor, or Class 12 subject slugs |
| Continuity   | Sem 2+ locks MAJOR, MINOR, AEC when configured             |
| Structure    | Selection counts must match semester rule                  |
| AEC          | Optional language eligibility slugs on profile             |
| Seats        | Confirmed if capacity available, else waitlist             |

## Deferred (Phase 2+)

- Semesters 4–8, GPA/CGPA, major/minor conversion UI
- Timetable conflict engine
- VTC internship tracking
- AI recommendations
