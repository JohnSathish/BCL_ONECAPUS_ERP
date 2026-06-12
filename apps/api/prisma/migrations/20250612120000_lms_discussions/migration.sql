-- LMS Discussions

CREATE TABLE "academic"."lms_discussions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_discussions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."lms_discussion_replies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "discussion_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_discussion_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lms_discussions_tenant_id_workspace_id_created_at_idx" ON "academic"."lms_discussions"("tenant_id", "workspace_id", "created_at");
CREATE INDEX "lms_discussion_replies_tenant_id_discussion_id_created_at_idx" ON "academic"."lms_discussion_replies"("tenant_id", "discussion_id", "created_at");

ALTER TABLE "academic"."lms_discussions" ADD CONSTRAINT "lms_discussions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "academic"."lms_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_discussions" ADD CONSTRAINT "lms_discussions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_discussion_replies" ADD CONSTRAINT "lms_discussion_replies_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "academic"."lms_discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_discussion_replies" ADD CONSTRAINT "lms_discussion_replies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
