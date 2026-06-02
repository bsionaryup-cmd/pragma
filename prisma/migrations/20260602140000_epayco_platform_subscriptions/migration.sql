-- ePayco platform billing preference (SaaS subscriptions)

ALTER TABLE "epayco_integrations" ADD COLUMN "preferForSubscriptionPayments" BOOLEAN NOT NULL DEFAULT false;
