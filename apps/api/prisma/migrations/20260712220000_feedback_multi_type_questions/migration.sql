-- Multi-type feedback questions + polymorphic answers
ALTER TABLE naac.feedback_questions
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS help_text TEXT,
  ADD COLUMN IF NOT EXISTS placeholder TEXT,
  ADD COLUMN IF NOT EXISTS default_value JSONB,
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS conditional_logic JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE naac.feedback_answers
  ALTER COLUMN rating DROP NOT NULL,
  ALTER COLUMN rating_label DROP NOT NULL;

ALTER TABLE naac.feedback_answers
  DROP CONSTRAINT IF EXISTS feedback_answers_rating_chk;

ALTER TABLE naac.feedback_answers
  ADD CONSTRAINT feedback_answers_rating_chk
  CHECK (rating IS NULL OR rating >= 1);

ALTER TABLE naac.feedback_answers
  ADD COLUMN IF NOT EXISTS value_text TEXT,
  ADD COLUMN IF NOT EXISTS value_number NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS value_bool BOOLEAN,
  ADD COLUMN IF NOT EXISTS value_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS value_json JSONB;
