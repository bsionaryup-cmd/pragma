-- Soft-delete marker: deleted users are hidden from team list.

ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "users_deleted_at_idx" ON "users" ("deletedAt");
