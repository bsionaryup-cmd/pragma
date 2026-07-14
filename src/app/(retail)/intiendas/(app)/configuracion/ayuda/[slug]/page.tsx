import { notFound } from "next/navigation";
import { getHelpArticle } from "@/domains/retail/help/catalog";
import { HelpArticleView } from "@/domains/retail/help/ui/help-center-views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function RetailHelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();
  return <HelpArticleView article={article} />;
}
