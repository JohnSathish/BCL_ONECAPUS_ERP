# Academic stream eligibility

## Concepts

| Concept             | Model                                 | Purpose                                                |
| ------------------- | ------------------------------------- | ------------------------------------------------------ |
| Academic stream     | `core.academic_streams`               | First-class stream master (Arts, Science, Commerce, …) |
| Student stream      | `student_academic_profiles.stream_id` | Assigned at admission; drives registration             |
| Section eligibility | `academic.offering_section_streams`   | Per delivery section — which streams may register      |

**Programme ≠ stream.** BA English is a programme; Arts is the stream.

## Rules

- Empty section eligibility = **open to all streams**
- Registration catalog filters sections by student stream
- Validation rejects ineligible selections: _This course is not available for your academic stream._
- Stream on student profile is immutable after semester activation unless `forceStreamChange` is set (admin)

## UI

| Screen                       | Field                         |
| ---------------------------- | ----------------------------- |
| Admissions → New application | Academic stream (required)    |
| Programs → Delivery section  | Eligible streams (checkboxes) |
| Student registration         | Auto-filtered catalog         |

## API

- `GET /api/v1/academic-engine/streams`
- Section create/update: `streamIds: string[]`
- Application create: `academicStreamId` (required)
