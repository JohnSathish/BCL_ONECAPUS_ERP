-- OneCampus institutional Knowledge Base
CREATE TABLE IF NOT EXISTS platform.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'CURRICULUM',
  version TEXT,
  file_name TEXT,
  page_count INT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_documents_tenant_status_idx
  ON platform.knowledge_documents (tenant_id, status);

CREATE TABLE IF NOT EXISTS platform.knowledge_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES platform.knowledge_documents(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  credits DECIMAL(5,2),
  semester INT,
  page_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_id, code)
);

CREATE INDEX IF NOT EXISTS knowledge_courses_tenant_code_idx
  ON platform.knowledge_courses (tenant_id, code);

CREATE TABLE IF NOT EXISTS platform.knowledge_semester_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES platform.knowledge_documents(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  total_credits INT NOT NULL,
  lines JSONB NOT NULL,
  page_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_id, semester)
);

CREATE TABLE IF NOT EXISTS platform.knowledge_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES platform.knowledge_documents(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  page_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_id, key)
);

CREATE INDEX IF NOT EXISTS knowledge_facts_tenant_key_idx
  ON platform.knowledge_facts (tenant_id, key);

CREATE TABLE IF NOT EXISTS platform.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES platform.knowledge_documents(id) ON DELETE CASCADE,
  page_no INT,
  heading TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_tenant_doc_idx
  ON platform.knowledge_chunks (tenant_id, document_id);
