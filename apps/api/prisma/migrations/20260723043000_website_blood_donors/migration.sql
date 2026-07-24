-- CreateTable
CREATE TABLE "academic"."website_blood_donors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "preferred_contact" TEXT NOT NULL DEFAULT 'Email',
    "blood_group" TEXT NOT NULL,
    "last_donation_date" DATE,
    "street_address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "pincode" TEXT NOT NULL DEFAULT '',
    "medical_notes" TEXT NOT NULL DEFAULT '',
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_blood_donors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_blood_donors_tenant_id_site_id_created_at_idx" ON "academic"."website_blood_donors"("tenant_id", "site_id", "created_at");

-- CreateIndex
CREATE INDEX "website_blood_donors_site_id_blood_group_idx" ON "academic"."website_blood_donors"("site_id", "blood_group");

-- CreateIndex
CREATE INDEX "website_blood_donors_site_id_email_idx" ON "academic"."website_blood_donors"("site_id", "email");

-- AddForeignKey
ALTER TABLE "academic"."website_blood_donors" ADD CONSTRAINT "website_blood_donors_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
