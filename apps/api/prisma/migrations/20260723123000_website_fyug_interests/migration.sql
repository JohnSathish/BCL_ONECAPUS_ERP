-- CreateTable
CREATE TABLE "academic"."website_fyug_interests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "photograph_url" TEXT,
    "photograph_key" TEXT,
    "gender" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "mobile" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "father_name" TEXT NOT NULL,
    "father_mobile" TEXT NOT NULL,
    "mother_name" TEXT NOT NULL,
    "mother_mobile" TEXT NOT NULL,
    "college_last_attended" TEXT NOT NULL,
    "affiliated_university" TEXT NOT NULL,
    "major_course" TEXT NOT NULL,
    "minor_course" TEXT NOT NULL,
    "applying_honours_in" TEXT NOT NULL,
    "cuet_score" TEXT NOT NULL DEFAULT '',
    "cgpa_semester_v" TEXT NOT NULL DEFAULT '',
    "percentage_semester_v" TEXT NOT NULL DEFAULT '',
    "has_back_papers" BOOLEAN NOT NULL DEFAULT false,
    "declaration_accepted" BOOLEAN NOT NULL DEFAULT true,
    "signature_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_fyug_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_fyug_interests_tenant_id_site_id_created_at_idx" ON "academic"."website_fyug_interests"("tenant_id", "site_id", "created_at");

-- CreateIndex
CREATE INDEX "website_fyug_interests_site_id_applying_honours_in_idx" ON "academic"."website_fyug_interests"("site_id", "applying_honours_in");

-- CreateIndex
CREATE INDEX "website_fyug_interests_site_id_email_idx" ON "academic"."website_fyug_interests"("site_id", "email");

-- AddForeignKey
ALTER TABLE "academic"."website_fyug_interests" ADD CONSTRAINT "website_fyug_interests_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
