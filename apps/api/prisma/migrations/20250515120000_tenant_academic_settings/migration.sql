-- CreateTable
CREATE TABLE "core"."tenant_academic_settings" (
    "tenant_id" UUID NOT NULL,
    "cbcs_enabled" BOOLEAN NOT NULL DEFAULT true,
    "nep_profile" JSONB,
    "credit_policy" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_academic_settings_pkey" PRIMARY KEY ("tenant_id")
);
