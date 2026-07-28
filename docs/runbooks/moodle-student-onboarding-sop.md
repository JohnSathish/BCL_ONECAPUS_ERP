# Student LMS Onboarding SOP (ERP → Moodle)

## Purpose

Ensure every newly admitted or promoted student can log in and see the correct courses in Moodle without manual Moodle registration.

Students **do not self-register on Moodle**. Access is provisioned from ERP via sync + SSO.

---

## How it works (simple)

1. Admin completes student admission/enrollment in ERP.
2. ERP queues Moodle sync jobs (user + course + enrolment).
3. Student logs into ERP student portal.
4. Student opens **LMS** and clicks **Launch Moodle** (or opens a Moodle-linked subject).
5. ERP issues SSO token → Moodle `auth_erp` logs student in.
6. Student sees enrolled courses in Moodle.

---

## Prerequisites (one-time platform setup)

- Moodle URL configured in ERP: `https://lms.donboscocollege.ac.in`
- Moodle web services + REST enabled
- External service `BCL ERP` + token saved in ERP Moodle Settings
- `auth_erp` plugin installed and enabled in Moodle
- ERP `.env` has valid `MOODLE_SSO_SECRET` and `MOODLE_TOKEN_ENCRYPTION_KEY`
- LMS workspaces provisioned for programme/semester subjects
- ERP LMS setting `defaultLmsProvider` set to `MOODLE` (if Moodle is default)

Verify once:

- ERP → **Academics → LMS → Moodle Settings → Test Connection** = PASS
- ERP → **Academics → LMS → Moodle Sync** = no growing failed jobs

---

## Admin checklist: per new student admission

Use this for each newly enrolled student.

### Step 1 — Create/enroll student in ERP

Complete the normal ERP flow:

- Admission approved / student record created
- `enrollFromApplication` (or equivalent enrollment action) completed
- Student assigned to programme, semester, section
- Subject registration/allocation completed (if required in your workflow)

Expected ERP side effects:

- Student portal account exists (login enabled)
- LMS workspaces exist for enrolled subjects
- Moodle hook queued: `hook-student-enrolled`

### Step 2 — Confirm sync jobs processed

ERP admin path:

- **Academics → LMS → Moodle Sync**
- Check failed jobs panel
- Requeue failed jobs if any for this student/time window

Optional manual sync (if hooks delayed):

- Run **Users** sync
- Run **Courses** sync
- Run **Enrolments** sync (or full sync)

### Step 3 — Verify Moodle user exists

In Moodle admin:

- **Site administration → Users → Browse list of users**
- Search by student email / username / idnumber from ERP

Pass criteria:

- User exists
- Account is not suspended
- Auth method includes ERP SSO (`auth_erp`) where applicable

### Step 4 — Verify course enrolments

In Moodle:

- Open each expected course → **Participants**
- Confirm student appears with **Student** role

In ERP:

- **Student portal → LMS**
- Student should see subject workspaces linked to enrolment

### Step 5 — Student login test (mandatory)

As the student (or test student):

1. Login ERP: `https://erp.donboscocollege.ac.in`
2. Open **LMS** (`/student/lms`)
3. Confirm subjects appear in dashboard
4. Click **Launch Moodle** on a Moodle-linked subject
5. Confirm Moodle opens without asking for separate Moodle password
6. Confirm enrolled courses visible in Moodle

Pass criteria:

- SSO works
- Course list matches ERP enrolment

---

## Automatic sync triggers (no manual action needed when healthy)

ERP enqueues Moodle jobs on:

- Student created/enrolled (`onStudentEnrolled`)
- Admission enrollment from application
- Registration approved (`onRegistrationApproved`)
- Promotion applied (`onPromotionApplied`)
- LMS workspace provisioned (`onWorkspaceProvisioned`)
- Staff created (faculty provisioning)

If queue/worker is healthy, onboarding is mostly automatic after ERP enrollment.

---

## Student instructions (share with students)

### Login

1. Go to ERP student portal.
2. Sign in with your college ERP credentials.
3. Open **LMS** from menu.

### View courses

- In ERP LMS dashboard, open your subject cards.
- For Moodle subjects, click **Launch Moodle**.
- Inside Moodle, open **Dashboard** or **My courses**.

### Important

- Do **not** create a separate Moodle account manually.
- If you cannot see a course, contact ERP/LMS helpdesk with:
  - Full name
  - Enrollment number
  - Programme + semester
  - Missing subject name

---

## Troubleshooting matrix

| Symptom                                       | Likely cause                              | Fix                                           |
| --------------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| Student cannot open LMS page in ERP           | No ERP portal account / wrong role        | Provision student portal account in ERP       |
| Launch Moodle fails / login loop              | SSO secret mismatch or plugin disabled    | Verify `MOODLE_SSO_SECRET`, enable `auth_erp` |
| Moodle opens but no courses                   | Enrolment sync not applied                | Run enrolment/full sync; requeue failed jobs  |
| Some subjects missing only                    | Workspace not provisioned/mapped          | Provision LMS workspaces; map subject-section |
| User exists in ERP but not Moodle             | User sync failed                          | Run Users sync; inspect failed job error      |
| Courses exist but student not in participants | Registration/allocation incomplete in ERP | Complete subject registration/allocation      |
| Everything synced but ERP LMS list empty      | Student not linked to offering/workspace  | Verify enrolment and workspace assignment     |

---

## Quick admin commands (VPS)

```bash
cd /opt/nep-erp
bash scripts/deploy/vps-smoke-moodle.sh
```

Check containers:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle ps
```

Check Moodle/API logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle logs api --tail 120
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle logs moodle --tail 120
```

---

## Go/No-Go for a newly onboarded student

Go only if all pass:

- ERP student login works
- ERP LMS dashboard shows expected subjects
- Launch Moodle SSO works
- Moodle shows same enrolled courses
- No unresolved failed sync jobs for that student window

---

## Related runbook

- Platform ops: `docs/runbooks/moodle-lms-sop.md`
