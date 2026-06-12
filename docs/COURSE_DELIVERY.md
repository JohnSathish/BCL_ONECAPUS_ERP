# Course delivery architecture (theory / practical)

## Two workload models

Course Master stores **two separate concepts**:

### Weekly teaching workload

Used for timetable generation, faculty allocation, classroom scheduling, and shift operations.

| Field                   | DB column                  |
| ----------------------- | -------------------------- |
| `theoryHoursPerWeek`    | `theory_hours_per_week`    |
| `practicalHoursPerWeek` | `practical_hours_per_week` |

### Semester contact hours (university compliance)

Used for NEHU/CBCS syllabus compliance, NAAC/NBA/UGC reporting, and examination eligibility (future). **Not derived from credits** — institutions define different credit-to-contact mappings.

| Field                        | DB column                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| `totalTheoryContactHours`    | `total_theory_contact_hours`                                     |
| `totalPracticalContactHours` | `total_practical_contact_hours`                                  |
| `totalContactHours`          | `total_contact_hours` (stored sum of theory + practical contact) |

Examples:

| Course              | Credits     | Contact hours |
| ------------------- | ----------- | ------------- |
| GEO-250 (theory)    | 4 theory    | 60 theory     |
| GEO-252 (practical) | 4 practical | 120 practical |
| VTC-260 (mixed)     | 1 + 3       | 30 + 75 = 105 |

## Other Course Master fields

| Field                                  | Purpose                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `delivery_type`                        | Descriptive label (THEORY, PRACTICAL, THEORY_PRACTICAL, …) — does not lock credits    |
| `has_practical`                        | Derived on save: `practical_credits > 0`, with delivery-type fallback for legacy rows |
| `theory_credits` / `practical_credits` | Credit split (total credits = sum; either may be 0, not both)                         |

### Validation (credit-pattern)

- **Invalid:** `theory_credits + practical_credits = 0`
- **Valid:** theory-only (4/0), practical-only (0/4), mixed (1+3)
- If a credit side is 0, weekly hours and semester contact hours on that side must be 0
- If a credit side is &gt; 0, semester contact hours on that side must be &gt; 0
- Contact hours are **not** derived from credits

NEP category (Major, MDC, AEC, …) stays on **curriculum mapping** (`course_offerings.category`), not on Course Master.

## Downstream consumers

| Module                            | Uses                                                     |
| --------------------------------- | -------------------------------------------------------- |
| **Timetable / shift ops**         | `theory_hours_per_week`, `practical_hours_per_week` only |
| **Fees**                          | `delivery_type`, practical flag                          |
| **Compliance / reports (future)** | Semester contact hour fields                             |
| **Examination (future)**          | `completed_contact_hours_percentage` — reserved          |

## API

- `POST/PATCH /v1/programs-courses/courses` — all delivery + contact fields; server validates cross-field rules and computes `totalContactHours`.

## Bulk import

Excel template includes **Total Theory Contact Hours** and **Total Practical Contact Hours**. See [COURSE_IMPORT.md](./COURSE_IMPORT.md).
