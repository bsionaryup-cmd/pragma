-- Default theme preference to light for new users.
ALTER TABLE "users" ALTER COLUMN "theme" SET DEFAULT 'light';
