-- Principal Mobile Executive Command Center (principal role only)

INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'principal-mobile:access', 'principal-mobile', 'access',
  'Principal Mobile Executive Command Center — Principal role only', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "platform"."permissions" WHERE "slug" = 'principal-mobile:access'
);

INSERT INTO "platform"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "platform"."roles" r
CROSS JOIN "platform"."permissions" p
WHERE r."slug" = 'principal'
  AND p."slug" = 'principal-mobile:access'
  AND NOT EXISTS (
    SELECT 1 FROM "platform"."role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
