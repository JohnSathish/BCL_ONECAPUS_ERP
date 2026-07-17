-- Campus Competitions Engine Phase B

CREATE TABLE IF NOT EXISTS academic.competition_houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563eb',
  logo_url TEXT,
  motto TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  merged_into_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS competition_houses_tenant_status_idx
  ON academic.competition_houses (tenant_id, status);

CREATE TABLE IF NOT EXISTS academic.competition_house_coordinators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (house_id, staff_id, role)
);
CREATE INDEX IF NOT EXISTS competition_house_coordinators_tenant_house_idx
  ON academic.competition_house_coordinators (tenant_id, house_id);

CREATE TABLE IF NOT EXISTS academic.competition_house_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  academic_year_id UUID,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_house_memberships_tenant_house_status_idx
  ON academic.competition_house_memberships (tenant_id, house_id, status);
CREATE INDEX IF NOT EXISTS competition_house_memberships_tenant_student_status_idx
  ON academic.competition_house_memberships (tenant_id, student_id, status);

CREATE TABLE IF NOT EXISTS academic.competition_house_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  from_house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE RESTRICT,
  to_house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  actor_id UUID,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS competition_house_transfers_tenant_student_idx
  ON academic.competition_house_transfers (tenant_id, student_id, transferred_at);

CREATE TABLE IF NOT EXISTS academic.competition_meets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  meet_type TEXT NOT NULL,
  academic_year_id UUID,
  venue TEXT NOT NULL DEFAULT '',
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  theme TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  leaderboard_version INT NOT NULL DEFAULT 0,
  created_by_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS competition_meets_tenant_status_idx
  ON academic.competition_meets (tenant_id, status);
CREATE INDEX IF NOT EXISTS competition_meets_tenant_type_starts_idx
  ON academic.competition_meets (tenant_id, meet_type, starts_at);

CREATE TABLE IF NOT EXISTS academic.competition_point_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID NOT NULL UNIQUE REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  first_points INT NOT NULL DEFAULT 10,
  second_points INT NOT NULL DEFAULT 7,
  third_points INT NOT NULL DEFAULT 5,
  participation_points INT NOT NULL DEFAULT 2,
  rules_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_point_rule_sets_tenant_idx
  ON academic.competition_point_rule_sets (tenant_id);

CREATE TABLE IF NOT EXISTS academic.competition_event_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  group_code TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_event_categories_tenant_meet_code_idx
  ON academic.competition_event_categories (tenant_id, meet_id, code);
CREATE INDEX IF NOT EXISTS competition_event_categories_tenant_group_idx
  ON academic.competition_event_categories (tenant_id, group_code);

CREATE TABLE IF NOT EXISTS academic.competition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID NOT NULL REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES academic.competition_event_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'OPEN',
  age_group TEXT NOT NULL DEFAULT 'OPEN',
  entry_mode TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  max_participants INT,
  max_team_size INT,
  venue TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  judge_staff_id UUID,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS competition_events_tenant_meet_status_idx
  ON academic.competition_events (tenant_id, meet_id, status);

CREATE TABLE IF NOT EXISTS academic.competition_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES academic.competition_events(id) ON DELETE CASCADE,
  house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, house_id, name)
);
CREATE INDEX IF NOT EXISTS competition_teams_tenant_event_idx
  ON academic.competition_teams (tenant_id, event_id);

CREATE TABLE IF NOT EXISTS academic.competition_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES academic.competition_teams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  sequence INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, student_id)
);
CREATE INDEX IF NOT EXISTS competition_team_members_tenant_team_idx
  ON academic.competition_team_members (tenant_id, team_id);

CREATE TABLE IF NOT EXISTS academic.competition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES academic.competition_events(id) ON DELETE CASCADE,
  house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE RESTRICT,
  student_id UUID,
  team_id UUID REFERENCES academic.competition_teams(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  status TEXT NOT NULL DEFAULT 'REGISTERED',
  bib_number TEXT,
  lane INT,
  nominated_by_id UUID,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_entries_tenant_event_status_idx
  ON academic.competition_entries (tenant_id, event_id, status);
CREATE INDEX IF NOT EXISTS competition_entries_tenant_house_idx
  ON academic.competition_entries (tenant_id, house_id);
CREATE INDEX IF NOT EXISTS competition_entries_tenant_student_idx
  ON academic.competition_entries (tenant_id, student_id);

CREATE TABLE IF NOT EXISTS academic.competition_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES academic.competition_events(id) ON DELETE CASCADE,
  round TEXT NOT NULL DEFAULT 'HEAT',
  heat_number INT,
  bracket_slot INT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  entry_ids JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_fixtures_tenant_event_round_idx
  ON academic.competition_fixtures (tenant_id, event_id, round);

CREATE TABLE IF NOT EXISTS academic.competition_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES academic.competition_events(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES academic.competition_entries(id) ON DELETE SET NULL,
  team_id UUID REFERENCES academic.competition_teams(id) ON DELETE SET NULL,
  position INT NOT NULL,
  metric_value TEXT,
  metric_unit TEXT,
  remarks TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMPTZ,
  recorded_by_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_results_tenant_event_status_idx
  ON academic.competition_results (tenant_id, event_id, status);

CREATE TABLE IF NOT EXISTS academic.house_point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID NOT NULL REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE RESTRICT,
  event_id UUID,
  result_id UUID,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  balance_after INT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS house_point_ledger_tenant_meet_house_idx
  ON academic.house_point_ledger (tenant_id, meet_id, house_id);
CREATE INDEX IF NOT EXISTS house_point_ledger_tenant_result_idx
  ON academic.house_point_ledger (tenant_id, result_id);

CREATE TABLE IF NOT EXISTS academic.competition_medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID NOT NULL REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  event_id UUID REFERENCES academic.competition_events(id) ON DELETE SET NULL,
  house_id UUID NOT NULL REFERENCES academic.competition_houses(id) ON DELETE RESTRICT,
  student_id UUID,
  metal TEXT NOT NULL,
  award_type TEXT NOT NULL DEFAULT 'PLACE',
  result_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_medals_tenant_meet_metal_idx
  ON academic.competition_medals (tenant_id, meet_id, metal);

CREATE TABLE IF NOT EXISTS academic.competition_certificate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID NOT NULL REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  event_id UUID,
  entry_id UUID,
  result_id UUID,
  certificate_issue_id UUID NOT NULL,
  certificate_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_certificate_links_tenant_meet_idx
  ON academic.competition_certificate_links (tenant_id, meet_id);
CREATE INDEX IF NOT EXISTS competition_certificate_links_tenant_issue_idx
  ON academic.competition_certificate_links (tenant_id, certificate_issue_id);

CREATE TABLE IF NOT EXISTS academic.competition_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID,
  house_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_audit_logs_tenant_action_idx
  ON academic.competition_audit_logs (tenant_id, action, created_at);
CREATE INDEX IF NOT EXISTS competition_audit_logs_tenant_meet_idx
  ON academic.competition_audit_logs (tenant_id, meet_id);

CREATE TABLE IF NOT EXISTS academic.competition_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  house_id UUID REFERENCES academic.competition_houses(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'PHOTO',
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  uploaded_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS competition_media_tenant_meet_idx
  ON academic.competition_media (tenant_id, meet_id);
CREATE INDEX IF NOT EXISTS competition_media_tenant_house_idx
  ON academic.competition_media (tenant_id, house_id);
