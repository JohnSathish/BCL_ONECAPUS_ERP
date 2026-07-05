-- Audit trail for OneCampus AI Assistant (tool calls and questions).
CREATE TABLE IF NOT EXISTS platform.ai_assistant_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT,
  question TEXT,
  intent JSONB,
  tools JSONB,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_assistant_audit_logs_tenant_created_idx
  ON platform.ai_assistant_audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_assistant_audit_logs_user_created_idx
  ON platform.ai_assistant_audit_logs (user_id, created_at DESC);
