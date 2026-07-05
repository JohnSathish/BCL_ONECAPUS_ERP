CREATE TABLE IF NOT EXISTS platform.knowledge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID REFERENCES platform.knowledge_documents(id) ON DELETE SET NULL,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, term)
);

CREATE INDEX IF NOT EXISTS knowledge_definitions_tenant_term_idx
  ON platform.knowledge_definitions (tenant_id, term);
