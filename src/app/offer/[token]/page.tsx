import { notFound } from "next/navigation";
import { PublicOfferView } from "@/components/sales/public-offer-view";
import { markQuoteViewedByToken } from "@/modules/sales/services/sales-quote.service";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicOfferPage({ params }: PageProps) {
  const { token } = await params;
  const quote = await markQuoteViewedByToken(token);
  if (!quote) notFound();

  return <PublicOfferView quote={quote} token={token} />;
}
