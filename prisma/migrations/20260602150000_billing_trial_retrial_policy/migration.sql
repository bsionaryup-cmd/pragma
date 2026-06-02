-- Owner-controlled SaaS trial retrial policy

CREATE TYPE "TrialRetrialPolicy" AS ENUM ('DEFAULT', 'ALLOW', 'BLOCK');

ALTER TABLE "billing_accounts" ADD COLUMN "trialRetrialPolicy" "TrialRetrialPolicy" NOT NULL DEFAULT 'DEFAULT';
