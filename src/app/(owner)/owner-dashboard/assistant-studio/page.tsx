import { db } from "@/lib/db";
import { AssistantStudioView } from "@/components/owner/assistant-studio-view";

export const dynamic = "force-dynamic";

export default async function AssistantStudioPage() {
  const allOrgs = await db.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  const blocked =
    /demo|epayco|wompi|platform\s*epayco|platform\s*wompi/i;
  const organizations = allOrgs.filter((o) => !blocked.test(o.name));

  const extensionId =
    process.env.NEXT_PUBLIC_CONCIERGE_EXTENSION_ID?.trim() ?? "";

  return (
    <AssistantStudioView
      organizations={organizations}
      extensionId={extensionId}
    />
  );
}
