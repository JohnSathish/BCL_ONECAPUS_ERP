-- Communication trigger dedupe logs

CREATE TABLE "platform"."communication_trigger_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "campaign_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_trigger_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_trigger_logs_tenant_id_trigger_key_entity_type_entity_id_key"
  ON "platform"."communication_trigger_logs"("tenant_id", "trigger_key", "entity_type", "entity_id");

CREATE INDEX "communication_trigger_logs_tenant_id_trigger_key_idx"
  ON "platform"."communication_trigger_logs"("tenant_id", "trigger_key");
