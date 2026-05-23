import { NextResponse } from "next/server";
import {
  platformOwnerErrorResponse,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import {
  getOwnerBillingInfraSnapshot,
  listOwnerFailedTransactions,
} from "@/services/platform/owner-billing-infra.service";

export async function GET() {
  try {
    await requirePlatformOwnerUser();
    const [snapshot, transactions] = await Promise.all([
      getOwnerBillingInfraSnapshot(),
      listOwnerFailedTransactions(50),
    ]);

    return NextResponse.json({
      invoices: snapshot.failedPayments,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        status: tx.status,
        amount: Number(tx.amount),
        currency: tx.currency,
        providerReference: tx.providerReference,
        organizationId:
          tx.invoice?.billingInvoice?.account?.organization?.id ?? null,
        organizationName:
          tx.invoice?.billingInvoice?.account?.organization?.name ?? null,
        createdAt: tx.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
