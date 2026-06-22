-- Careers portal: vacancy SEO fields + application sequence

ALTER TABLE academic.recruitment_vacancies
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS job_description_html TEXT,
  ADD COLUMN IF NOT EXISTS qualification_required TEXT,
  ADD COLUMN IF NOT EXISTS experience_required TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_json JSONB,
  ADD COLUMN IF NOT EXISTS salary_min DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS salary_max DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS important_dates_json JSONB,
  ADD COLUMN IF NOT EXISTS advertisement_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS terms_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS instructions_html TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS recruitment_vacancies_tenant_slug_key
  ON academic.recruitment_vacancies (tenant_id, slug)
  WHERE slug IS NOT NULL;

ALTER TABLE academic.recruitment_applications
  ADD COLUMN IF NOT EXISTS application_details_json JSONB,
  ADD COLUMN IF NOT EXISTS certificates_json JSONB,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'INTERNAL';

CREATE TABLE IF NOT EXISTS academic.recruitment_application_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  year INT NOT NULL,
  current_no INT NOT NULL DEFAULT 0,
  prefix TEXT NOT NULL DEFAULT 'DBC-APP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, year)
);
