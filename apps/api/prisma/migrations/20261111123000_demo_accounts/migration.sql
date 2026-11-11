ALTER TABLE platform.users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'NORMAL';

ALTER TABLE academic.students
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'NORMAL';

ALTER TABLE academic.staff_profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'NORMAL';

ALTER TABLE platform.users DROP CONSTRAINT IF EXISTS users_account_type_check;
ALTER TABLE platform.users
  ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('NORMAL', 'DEMO'));

ALTER TABLE academic.students DROP CONSTRAINT IF EXISTS students_account_type_check;
ALTER TABLE academic.students
  ADD CONSTRAINT students_account_type_check CHECK (account_type IN ('NORMAL', 'DEMO'));

ALTER TABLE academic.staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_account_type_check;
ALTER TABLE academic.staff_profiles
  ADD CONSTRAINT staff_profiles_account_type_check CHECK (account_type IN ('NORMAL', 'DEMO'));

CREATE INDEX IF NOT EXISTS users_tenant_account_type_idx
  ON platform.users (tenant_id, account_type);
CREATE INDEX IF NOT EXISTS students_tenant_account_type_idx
  ON academic.students (tenant_id, account_type);
CREATE INDEX IF NOT EXISTS staff_profiles_tenant_account_type_idx
  ON academic.staff_profiles (tenant_id, account_type);

CREATE TABLE IF NOT EXISTS platform.demo_notification_tests (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  sent_by_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  push_status TEXT NOT NULL,
  push_detail TEXT,
  notification_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS demo_notification_tests_user_idx
  ON platform.demo_notification_tests (tenant_id, user_id, created_at DESC);
