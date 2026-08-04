-- Staff leave: store real approver identity/role for correct Staff UI status labels
ALTER TABLE "academic"."staff_leave_applications"
  ADD COLUMN IF NOT EXISTS "reviewed_by_name" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by_role" TEXT,
  ADD COLUMN IF NOT EXISTS "approval_remarks" TEXT;
