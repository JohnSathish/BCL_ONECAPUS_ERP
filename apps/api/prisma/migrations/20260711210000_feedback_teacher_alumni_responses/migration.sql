-- Allow teacher/alumni responses without a student profile.
-- One response per student (when set) and one per respondent user per campaign.

ALTER TABLE naac.feedback_responses
  ALTER COLUMN student_id DROP NOT NULL;

-- Drop the old unique if present (Prisma name may vary)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feedback_responses_tenant_id_campaign_id_student_id_key'
      AND conrelid = 'naac.feedback_responses'::regclass
  ) THEN
    ALTER TABLE naac.feedback_responses
      DROP CONSTRAINT feedback_responses_tenant_id_campaign_id_student_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS feedback_responses_tenant_campaign_student_uidx
  ON naac.feedback_responses (tenant_id, campaign_id, student_id)
  WHERE student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS feedback_responses_tenant_campaign_user_uidx
  ON naac.feedback_responses (tenant_id, campaign_id, respondent_user_id)
  WHERE respondent_user_id IS NOT NULL;
