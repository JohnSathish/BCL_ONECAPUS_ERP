CREATE TABLE IF NOT EXISTS platform.student_display_settings (
  tenant_id UUID PRIMARY KEY REFERENCES platform.tenants(id) ON DELETE CASCADE,
  name_display_format TEXT NOT NULL DEFAULT 'UPPERCASE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
