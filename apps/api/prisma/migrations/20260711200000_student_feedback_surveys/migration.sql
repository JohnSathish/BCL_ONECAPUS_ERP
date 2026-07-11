-- Student Feedback & Survey (IQAC Phase 1)
CREATE TABLE IF NOT EXISTS naac.feedback_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  audience TEXT NOT NULL DEFAULT 'STUDENT',
  academic_year TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  starts_at DATE,
  ends_at DATE,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_campaigns_tenant_audience_enabled_idx
  ON naac.feedback_campaigns (tenant_id, audience, enabled);
CREATE INDEX IF NOT EXISTS feedback_campaigns_tenant_year_idx
  ON naac.feedback_campaigns (tenant_id, academic_year);
CREATE INDEX IF NOT EXISTS feedback_campaigns_tenant_status_idx
  ON naac.feedback_campaigns (tenant_id, status);

CREATE TABLE IF NOT EXISTS naac.feedback_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES naac.feedback_campaigns(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OVERALL',
  required BOOLEAN NOT NULL DEFAULT true,
  question_type TEXT NOT NULL DEFAULT 'LIKERT_5',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_questions_campaign_sort_idx
  ON naac.feedback_questions (tenant_id, campaign_id, sort_order);

CREATE TABLE IF NOT EXISTS naac.feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES naac.feedback_campaigns(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  respondent_user_id UUID,
  department_id UUID,
  programme_hint TEXT,
  semester_no INT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT feedback_responses_unique_student UNIQUE (tenant_id, campaign_id, student_id)
);

CREATE INDEX IF NOT EXISTS feedback_responses_campaign_submitted_idx
  ON naac.feedback_responses (tenant_id, campaign_id, submitted_at);
CREATE INDEX IF NOT EXISTS feedback_responses_student_idx
  ON naac.feedback_responses (tenant_id, student_id);

CREATE TABLE IF NOT EXISTS naac.feedback_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  response_id UUID NOT NULL REFERENCES naac.feedback_responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES naac.feedback_questions(id) ON DELETE CASCADE,
  rating INT NOT NULL,
  rating_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feedback_answers_unique_q UNIQUE (response_id, question_id),
  CONSTRAINT feedback_answers_rating_chk CHECK (rating >= 1 AND rating <= 5)
);

CREATE INDEX IF NOT EXISTS feedback_answers_question_rating_idx
  ON naac.feedback_answers (tenant_id, question_id, rating);
