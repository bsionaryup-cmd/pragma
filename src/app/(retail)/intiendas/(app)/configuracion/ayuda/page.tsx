import { HelpCenterHome } from "@/domains/retail/help/ui/help-center-views";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function RetailHelpCenterPage({ searchParams }: Props) {
  const { q } = await searchParams;
  return <HelpCenterHome query={q ?? ""} />;
}
