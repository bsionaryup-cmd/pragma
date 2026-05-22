import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const PAYMENT_LEDGER_HINT =
  "Payment ledger: ejecuta npx prisma generate && npm run db:migrate:deploy";

export function isPaymentSchemaMissing(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") return true;
    const table = error.meta?.table;
    if (typeof table === "string" && table.startsWith("payment_")) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("payment_transactions") ||
    message.includes("payment_invoices") ||
    message.includes("payment_webhook_logs")
  );
}

export function hasPaymentLedgerDelegates(): boolean {
  const client = db as {
    paymentTransaction?: { findMany: unknown };
    paymentInvoice?: { findMany: unknown };
    paymentWebhookLog?: { create: unknown };
  };
  return Boolean(
    client.paymentTransaction?.findMany &&
      client.paymentInvoice?.findMany &&
      client.paymentWebhookLog?.create,
  );
}
