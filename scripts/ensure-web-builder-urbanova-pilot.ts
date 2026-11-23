/**
 * Garantiza el sitio piloto URBA NOVA (urbanovaloft) en DRAFT con propiedades sincronizadas.
 * Uso: npx tsx --require ./scripts/_mock-server-only.cjs scripts/ensure-web-builder-urbanova-pilot.ts
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

async function main() {
  const { ensureUrbanovaPilotWebSite } = await import(
    "@/services/web-builder/ensure-urbanova-pilot.service"
  );
  const { site, propertyCount } = await ensureUrbanovaPilotWebSite();
  console.log(
    JSON.stringify(
      {
        siteId: site.id,
        slug: site.slug,
        status: site.status,
        siteName: site.siteName,
        propertyCount,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
