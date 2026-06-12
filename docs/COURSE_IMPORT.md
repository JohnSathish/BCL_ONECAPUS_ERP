# Course Master Excel import / export

## Overview

Bulk course operations live under **Programs & courses → Course master**:

- **Download template** — `Course_Import_Template.xlsx`
- **Import Excel** — validate, preview, commit
- **Export courses** — full catalog download

Requires permission `academic:manage` (College Admin).

## Template columns

| Column                 | Required |
| ---------------------- | -------- |
| Course Code            | Yes      |
| Course Title           | Yes      |
| Delivery Type          | Yes      |
| Theory Credits         | Yes      |
| Practical Credits      | Yes      |
| Weekly Theory Hours    | Yes      |
| Weekly Practical Hours | Yes      |
| CBCS Catalog Type      | Yes      |
| Department Code        | Yes      |
| Description            | No       |

**Delivery types:** `THEORY`, `PRACTICAL`, `THEORY_PRACTICAL`, `PROJECT`, `FIELD_WORK`, `INTERNSHIP`, `STUDIO` (Excel may use `FIELDWORK` as alias).

**CBCS types:** `CORE`, `ELECTIVE`, `SKILL`, `OPEN`, `LAB`, `PRACTICAL`.

Do **not** put NEP categories (Major, MDC, AEC, etc.) in this file — use **Curriculum mapping**.

## Import modes

- **Import valid rows only** (`VALID_ONLY`) — inserts only rows that passed validation.
- **Strict** (`STRICT`) — fails if any row is invalid; nothing is inserted.

## Async processing

Files with more than **500 rows** are validated/committed via the BullMQ `exports` queue. The API process must be running (it hosts the processor). Redis is required:

```bash
docker compose up -d redis
```

Poll batch status via `GET /v1/programs-courses/courses/import/batches/:id`.

## API endpoints

| Method | Path                                                           |
| ------ | -------------------------------------------------------------- |
| GET    | `/v1/programs-courses/courses/import/template`                 |
| POST   | `/v1/programs-courses/courses/import/validate`                 |
| POST   | `/v1/programs-courses/courses/import/commit`                   |
| GET    | `/v1/programs-courses/courses/import/batches`                  |
| GET    | `/v1/programs-courses/courses/import/batches/:id`              |
| GET    | `/v1/programs-courses/courses/import/batches/:id/preview`      |
| GET    | `/v1/programs-courses/courses/import/batches/:id/error-report` |
| GET    | `/v1/programs-courses/courses/export`                          |

## Architecture

Reusable import engine: `apps/api/src/common/import/`. Course-specific rules: `apps/api/src/modules/programs-courses/import/`.

Import history is stored in `academic.import_batches` and `academic.import_batch_rows`.
