import { redirect } from "next/navigation";
import { SalesConsoleView } from "@/components/sales/sales-console-view";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { listSalesDiscountCodes } from "@/modules/sales/services/sales-discount-code.service";
import { listSalesQuotes } from "@/modules/sales/services/sales-quote.service";

function serializeSalesQuotesForClient(
  quotes: Awaited<ReturnType<typeof listSalesQuotes>>,
) {
  return quotes.map((quote) => ({
    ...quote,
    discountPercent:
      quote.discountPercent != null ? Number(quote.discountPercent) : null,
    discountAmountCop:
      quote.discountAmountCop != null ? Number(quote.discountAmountCop) : null,
    listAmountCop: Number(quote.listAmountCop),
    savingsAmountCop: Number(quote.savingsAmountCop),
    finalAmountCop: Number(quote.finalAmountCop),
  }));
}

function serializeSalesDiscountCodesForClient(
  codes: Awaited<ReturnType<typeof listSalesDiscountCodes>>,
) {
  return codes.map((code) => ({
    ...code,
    value: Number(code.value),
  }));
}

export default async function OwnerSalesPage() {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      redirect("/unauthorized");
    }
    throw error;
  }

  const [quotes, codes] = await Promise.all([
    listSalesQuotes({ limit: 80 }),
    listSalesDiscountCodes(),
  ]);

  return (
    <SalesConsoleView
      initialQuotes={serializeSalesQuotesForClient(quotes)}
      initialCodes={serializeSalesDiscountCodesForClient(codes)}
    />
  );
}
