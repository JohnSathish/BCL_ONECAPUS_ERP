-- Portal logins that still use the roll from before a shift transfer
-- move to the current roll. The old roll is kept on the transfer record.

UPDATE platform.users AS u
SET username = latest.roll_number,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (s.id)
    s.user_id,
    s.tenant_id,
    s.roll_number,
    t.old_roll_number
  FROM academic.students AS s
  JOIN academic.student_shift_transfers AS t ON t.student_id = s.id
  WHERE s.deleted_at IS NULL
    AND s.roll_number IS NOT NULL
    AND t.status = 'approved'
    AND t.new_roll_number = s.roll_number
    AND t.old_roll_number IS NOT NULL
  ORDER BY s.id, t.approved_at DESC NULLS LAST, t.created_at DESC
) AS latest
WHERE u.id = latest.user_id
  AND u.deleted_at IS NULL
  AND lower(u.username) = lower(latest.old_roll_number)
  AND lower(u.username) <> lower(latest.roll_number)
  AND NOT EXISTS (
    SELECT 1
    FROM platform.users AS other
    WHERE other.tenant_id = u.tenant_id
      AND other.id <> u.id
      AND other.deleted_at IS NULL
      AND lower(other.username) = lower(latest.roll_number)
  );

UPDATE academic.students AS s
SET enrollment_number = latest.roll_number,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (student.id)
    student.id,
    student.tenant_id,
    student.roll_number,
    transfer.old_roll_number
  FROM academic.students AS student
  JOIN academic.student_shift_transfers AS transfer ON transfer.student_id = student.id
  WHERE student.deleted_at IS NULL
    AND student.roll_number IS NOT NULL
    AND transfer.status = 'approved'
    AND transfer.new_roll_number = student.roll_number
    AND transfer.old_roll_number IS NOT NULL
    AND lower(student.enrollment_number) = lower(transfer.old_roll_number)
  ORDER BY student.id, transfer.approved_at DESC NULLS LAST, transfer.created_at DESC
) AS latest
WHERE s.id = latest.id
  AND lower(s.enrollment_number) <> lower(latest.roll_number)
  AND NOT EXISTS (
    SELECT 1
    FROM academic.students AS other
    WHERE other.tenant_id = s.tenant_id
      AND other.id <> s.id
      AND other.deleted_at IS NULL
      AND lower(other.enrollment_number) = lower(latest.roll_number)
  );
