CREATE TABLE IF NOT EXISTS public.proposal_presets (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_presets_tenant_id_idx
  ON public.proposal_presets (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS proposal_presets_tenant_name_uidx
  ON public.proposal_presets (tenant_id, name);
