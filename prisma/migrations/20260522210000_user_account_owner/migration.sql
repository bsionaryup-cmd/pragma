-- Account owner: primary tenant holder, protected from admin mutations.

ALTER TABLE "users" ADD COLUMN "isAccountOwner" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users"
SET "isAccountOwner" = true
WHERE "id" = (
  SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1
);

CREATE UNIQUE INDEX "users_single_account_owner_idx"
ON "users" ("isAccountOwner")
WHERE "isAccountOwner" = true;
