import { redirect } from "next/navigation";
import { SalesConsoleView } from "@/components/sales/sales-console-view";
import { requireDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { listSalesDiscountCodes } from "@/modules/sales/services/sales-discount-code.service";
import { listSalesQuotes } from "@/modules/sales/services/sales-quote.service";

export default async function OwnerSalesPage() {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    redirect("/unauthorized");
  }

  const [quotes, codes] = await Promise.all([
    listSalesQuotes({ limit: 80 }),
    listSalesDiscountCodes(),
  ]);

  return <SalesConsoleView initialQuotes={quotes} initialCodes={codes} />;
}
