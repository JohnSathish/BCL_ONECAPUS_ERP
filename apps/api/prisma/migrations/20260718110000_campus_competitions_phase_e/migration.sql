-- Campus Competitions Phase E: trophy inventory + awards

CREATE TABLE IF NOT EXISTS academic.competition_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  trophy_type TEXT NOT NULL DEFAULT 'CUP',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS competition_trophies_tenant_status_idx
  ON academic.competition_trophies (tenant_id, status);

CREATE TABLE IF NOT EXISTS academic.competition_trophy_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trophy_id UUID NOT NULL REFERENCES academic.competition_trophies(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL,
  meet_id UUID REFERENCES academic.competition_meets(id) ON DELETE SET NULL,
  house_id UUID REFERENCES academic.competition_houses(id) ON DELETE SET NULL,
  student_id UUID,
  award_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by_id UUID,
  returned_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_trophy_awards_tenant_year_type_idx
  ON academic.competition_trophy_awards (tenant_id, academic_year_id, award_type);
CREATE INDEX IF NOT EXISTS competition_trophy_awards_tenant_trophy_idx
  ON academic.competition_trophy_awards (tenant_id, trophy_id);
CREATE INDEX IF NOT EXISTS competition_trophy_awards_tenant_house_idx
  ON academic.competition_trophy_awards (tenant_id, house_id);

CREATE INDEX IF NOT EXISTS competition_meets_tenant_academic_year_idx
  ON academic.competition_meets (tenant_id, academic_year_id);
