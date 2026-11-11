CREATE TABLE IF NOT EXISTS platform.birthday_popup_acks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'STUDENT',
  birthday_date VARCHAR(10) NOT NULL,
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS birthday_popup_acks_user_day_key
  ON platform.birthday_popup_acks (tenant_id, user_id, user_type, birthday_date);

CREATE INDEX IF NOT EXISTS birthday_popup_acks_user_idx
  ON platform.birthday_popup_acks (tenant_id, user_id);
