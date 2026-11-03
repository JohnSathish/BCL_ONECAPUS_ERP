-- Append-only circulation history: one row per issue, renewal and return.
-- Existing loans are backfilled below. The trigger at the end rejects UPDATE
-- and DELETE so the history cannot be rewritten.

CREATE TABLE "library"."library_circulation_transactions" (
    "id" UUID NOT NULL,
    "seq_no" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "copy_id" UUID NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "member_type" TEXT NOT NULL,
    "student_id" UUID,
    "staff_profile_id" UUID,
    "borrower_name" TEXT,
    "borrower_code" TEXT,
    "department_id" UUID,
    "department_name" TEXT,
    "semester_no" INTEGER,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "previous_due_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "renewal_number" INTEGER NOT NULL DEFAULT 0,
    "returned_at" TIMESTAMP(3),
    "returned_by_type" TEXT,
    "returned_by_name" TEXT,
    "returned_by_code" TEXT,
    "returned_by_student_id" UUID,
    "returned_by_staff_id" UUID,
    "processed_by_id" UUID,
    "processed_by_name" TEXT,
    "book_condition" TEXT,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "days_late" INTEGER,
    "fine_amount" DECIMAL(10,2),
    "fine_id" UUID,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DESK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_circulation_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_circulation_transactions_seq_no_key" ON "library"."library_circulation_transactions"("seq_no");
CREATE INDEX "library_circulation_transactions_tenant_id_occurred_at_idx" ON "library"."library_circulation_transactions"("tenant_id", "occurred_at");
CREATE INDEX "library_circulation_transactions_tenant_id_transaction_type_idx" ON "library"."library_circulation_transactions"("tenant_id", "transaction_type", "occurred_at");
CREATE INDEX "library_circulation_transactions_tenant_id_loan_id_idx" ON "library"."library_circulation_transactions"("tenant_id", "loan_id");
CREATE INDEX "library_circulation_transactions_tenant_id_student_id_idx" ON "library"."library_circulation_transactions"("tenant_id", "student_id");
CREATE INDEX "library_circulation_transactions_tenant_id_staff_profile_id_idx" ON "library"."library_circulation_transactions"("tenant_id", "staff_profile_id");
CREATE INDEX "library_circulation_transactions_tenant_id_department_id_idx" ON "library"."library_circulation_transactions"("tenant_id", "department_id");
CREATE INDEX "library_circulation_transactions_tenant_id_processed_by_id_idx" ON "library"."library_circulation_transactions"("tenant_id", "processed_by_id");

ALTER TABLE "library"."library_circulation_transactions" ADD CONSTRAINT "library_circulation_transactions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "library"."library_loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "library"."library_circulation_transactions" ADD CONSTRAINT "library_circulation_transactions_copy_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "library"."library_book_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill from existing loans.
-- Before this table existed, a renewal overwrote the due date and the audit
-- log did not store the loan id. Renewals are matched to loans by accession
-- number and time. Who physically returned a book was never recorded, so
-- backfilled returns leave returned_by_* empty.
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _borrower AS
SELECT
  l.id AS loan_id,
  COALESCE(sp.full_name, st.full_name) AS borrower_name,
  COALESCE(NULLIF(s.roll_number, ''), s.enrollment_number, st.employee_code) AS borrower_code,
  COALESCE(s.department_id, st.department_id) AS department_id,
  d.department_name AS department_name,
  sas.current_semester_sequence AS semester_no
FROM library.library_loans l
LEFT JOIN academic.students s ON s.id = l.student_id
LEFT JOIN academic.student_profiles sp ON sp.student_id = s.id
LEFT JOIN academic.student_academic_standings sas ON sas.student_id = s.id
LEFT JOIN academic.staff_profiles st ON st.id = l.staff_profile_id
LEFT JOIN core.departments d ON d.id = COALESCE(s.department_id, st.department_id);

CREATE TEMP TABLE _renewal AS
SELECT DISTINCT ON (a.id)
  a.id AS audit_id,
  a.tenant_id,
  a.actor_id,
  a.created_at,
  l.id AS loan_id,
  l.copy_id,
  CASE WHEN COALESCE(a.metadata->>'previousDueAt', '') <> ''
       THEN ((a.metadata->>'previousDueAt')::timestamptz AT TIME ZONE 'UTC') END AS previous_due_at,
  CASE WHEN COALESCE(a.metadata->>'dueAt', '') <> ''
       THEN ((a.metadata->>'dueAt')::timestamptz AT TIME ZONE 'UTC') END AS due_at
FROM library.library_audit_logs a
JOIN library.library_book_copies c
  ON c.tenant_id = a.tenant_id
 AND (c.accession_number = a.metadata->>'accessionNumber' OR c.barcode = a.metadata->>'accessionNumber')
JOIN library.library_loans l
  ON l.copy_id = c.id
 AND l.issued_at <= a.created_at
 AND (l.returned_at IS NULL OR l.returned_at >= a.created_at)
WHERE a.action = 'RENEW'
  AND COALESCE(a.entity_type, 'LOAN') = 'LOAN'
ORDER BY a.id, l.issued_at DESC;

INSERT INTO library.library_circulation_transactions (
  id, tenant_id, loan_id, copy_id, transaction_type, occurred_at, member_type,
  student_id, staff_profile_id, borrower_name, borrower_code, department_id,
  department_name, semester_no, issued_at, previous_due_at, due_at,
  renewal_number, processed_by_id, processed_by_name, source, created_at
)
SELECT
  gen_random_uuid(), l.tenant_id, l.id, l.copy_id, 'ISSUE', l.issued_at, l.member_type,
  l.student_id, l.staff_profile_id, b.borrower_name, b.borrower_code, b.department_id,
  b.department_name, b.semester_no, l.issued_at, NULL,
  CASE
    WHEN l.renewal_count = 0 THEN l.due_at
    ELSE (SELECT r.previous_due_at FROM _renewal r WHERE r.loan_id = l.id ORDER BY r.created_at LIMIT 1)
  END,
  0, l.issued_by_id, COALESCE(NULLIF(u.display_name, ''), u.email), 'BACKFILL', CURRENT_TIMESTAMP
FROM library.library_loans l
JOIN _borrower b ON b.loan_id = l.id
LEFT JOIN platform.users u ON u.id = l.issued_by_id;

INSERT INTO library.library_circulation_transactions (
  id, tenant_id, loan_id, copy_id, transaction_type, occurred_at, member_type,
  student_id, staff_profile_id, borrower_name, borrower_code, department_id,
  department_name, semester_no, issued_at, previous_due_at, due_at,
  renewal_number, processed_by_id, processed_by_name, source, created_at
)
SELECT
  gen_random_uuid(), r.tenant_id, r.loan_id, r.copy_id, 'RENEW', r.created_at, l.member_type,
  l.student_id, l.staff_profile_id, b.borrower_name, b.borrower_code, b.department_id,
  b.department_name, b.semester_no, l.issued_at, r.previous_due_at, r.due_at,
  ROW_NUMBER() OVER (PARTITION BY r.loan_id ORDER BY r.created_at)::int,
  r.actor_id, COALESCE(NULLIF(u.display_name, ''), u.email), 'BACKFILL', CURRENT_TIMESTAMP
FROM _renewal r
JOIN library.library_loans l ON l.id = r.loan_id
JOIN _borrower b ON b.loan_id = l.id
LEFT JOIN platform.users u ON u.id = r.actor_id;

INSERT INTO library.library_circulation_transactions (
  id, tenant_id, loan_id, copy_id, transaction_type, occurred_at, member_type,
  student_id, staff_profile_id, borrower_name, borrower_code, department_id,
  department_name, semester_no, issued_at, previous_due_at, due_at,
  renewal_number, returned_at, processed_by_id, processed_by_name,
  book_condition, is_late, days_late, fine_amount, fine_id, source, created_at
)
SELECT
  gen_random_uuid(), l.tenant_id, l.id, l.copy_id, 'RETURN', l.returned_at, l.member_type,
  l.student_id, l.staff_profile_id, b.borrower_name, b.borrower_code, b.department_id,
  b.department_name, b.semester_no, l.issued_at, NULL, l.due_at,
  l.renewal_count, l.returned_at, l.returned_by_id, COALESCE(NULLIF(u.display_name, ''), u.email),
  (SELECT i.incident_type FROM library.library_copy_incidents i
    WHERE i.loan_id = l.id AND i.incident_type IN ('LOST', 'DAMAGED')
    ORDER BY i.created_at LIMIT 1),
  dates.ret_d > dates.due_d,
  CASE WHEN dates.ret_d > dates.due_d THEN (
    SELECT COUNT(*)::int FROM generate_series(dates.due_d + 1, dates.ret_d, interval '1 day') g
    WHERE EXTRACT(DOW FROM g) <> 0
  ) ELSE 0 END,
  (SELECT SUM(f.amount) FROM library.library_fines f WHERE f.loan_id = l.id),
  (SELECT f.id FROM library.library_fines f WHERE f.loan_id = l.id ORDER BY f.created_at LIMIT 1),
  'BACKFILL', CURRENT_TIMESTAMP
FROM library.library_loans l
JOIN _borrower b ON b.loan_id = l.id
LEFT JOIN platform.users u ON u.id = l.returned_by_id
CROSS JOIN LATERAL (
  SELECT
    ((l.returned_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS ret_d,
    ((l.due_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS due_d
) dates
WHERE l.returned_at IS NOT NULL;

DROP TABLE _renewal;
DROP TABLE _borrower;

-- ---------------------------------------------------------------------------
-- Immutability: history rows are inserted once and never changed or removed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION library.reject_circulation_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'library_circulation_transactions is append-only (% is not allowed)', TG_OP;
END;
$$;

CREATE TRIGGER library_circulation_transactions_append_only
BEFORE UPDATE OR DELETE ON library.library_circulation_transactions
FOR EACH ROW EXECUTE FUNCTION library.reject_circulation_transaction_change();
