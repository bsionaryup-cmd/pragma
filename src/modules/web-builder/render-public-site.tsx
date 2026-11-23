import type { PublicSitePayload } from "@/lib/web-builder/serialize-public-site";
import { UrbanBoutiqueLayout } from "@/modules/web-builder/templates/urban-boutique/urban-boutique-layout";
import { UrbanBoutiqueSite } from "@/modules/web-builder/templates/urban-boutique/urban-boutique-site";

export function renderTenantPublicSite(
  site: PublicSitePayload,
  options?: { preview?: boolean },
) {
  return (
    <UrbanBoutiqueLayout site={site}>
      <UrbanBoutiqueSite site={site} preview={options?.preview} />
    </UrbanBoutiqueLayout>
  );
}