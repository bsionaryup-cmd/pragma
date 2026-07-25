/**
 * PRAGMA PMS knowledge provider — FAQ articles + thin facade (tools stay in Concierge).
 */
import { db } from "@/lib/db";
import type {
  KnowledgeHit,
  KnowledgeProvider,
  KnowledgeQuery,
} from "@/modules/assistant-platform/knowledge/provider";
import { PRAGMA_PMS_PROVIDER_META } from "@/modules/assistant-platform/knowledge/provider";

export class PragmaPmsKnowledgeProvider implements KnowledgeProvider {
  readonly key = PRAGMA_PMS_PROVIDER_META.key;
  readonly displayName = PRAGMA_PMS_PROVIDER_META.displayName;
  readonly capabilities = [...PRAGMA_PMS_PROVIDER_META.capabilities];

  async search(input: KnowledgeQuery): Promise<KnowledgeHit[]> {
    if (!input.assistantId) return [];
    const q = input.query.trim().toLowerCase();
    if (!q) return [];

    const articles = await db.assistantKnowledgeArticle.findMany({
      where: {
        assistantId: input.assistantId,
        enabled: true,
        ...(input.propertyId
          ? {
              OR: [{ propertyId: input.propertyId }, { propertyId: null }],
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: input.limit ?? 8,
    });

    const hits: KnowledgeHit[] = [];
    for (const row of articles) {
      const hay = `${row.title} ${row.body} ${row.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q) && !q.split(/\s+/).some((w) => w.length > 2 && hay.includes(w))) {
        continue;
      }
      hits.push({
        providerKey: this.key,
        title: row.title,
        body: row.body,
        score: hay.includes(q) ? 1 : 0.6,
        source: "faq",
      });
    }
    return hits.sort((a, b) => b.score - a.score);
  }
}

export const pragmaPmsKnowledgeProvider = new PragmaPmsKnowledgeProvider();
