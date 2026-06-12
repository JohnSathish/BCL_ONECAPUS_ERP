-- StaffSubjectEligibility and StaffQualification for bulk staff import

CREATE TABLE "academic"."staff_subject_eligibility" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_subject_eligibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_qualifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "qualification" TEXT NOT NULL,
    "specialization" TEXT,
    "university" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_subject_eligibility_staff_profile_id_course_id_key"
    ON "academic"."staff_subject_eligibility"("staff_profile_id", "course_id");

CREATE INDEX "staff_subject_eligibility_tenant_id_idx"
    ON "academic"."staff_subject_eligibility"("tenant_id");

CREATE INDEX "staff_subject_eligibility_staff_profile_id_idx"
    ON "academic"."staff_subject_eligibility"("staff_profile_id");

CREATE INDEX "staff_qualifications_tenant_id_staff_profile_id_idx"
    ON "academic"."staff_qualifications"("tenant_id", "staff_profile_id");

ALTER TABLE "academic"."staff_subject_eligibility"
    ADD CONSTRAINT "staff_subject_eligibility_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."staff_subject_eligibility"
    ADD CONSTRAINT "staff_subject_eligibility_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."staff_qualifications"
    ADD CONSTRAINT "staff_qualifications_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
