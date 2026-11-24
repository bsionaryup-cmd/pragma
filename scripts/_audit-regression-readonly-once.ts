/**
 * Read-only regression fingerprint. Never writes.
 * Prefers staging (.env.staging) when PRAGMA_WEB_BUILDER_STAGING=1.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

const useStaging = process.env.PRAGMA_WEB_BUILDER_STAGING === "1";
delete process.env.DATABASE_URL;
config({ path: resolve(process.cwd(), ".env") });
if (useStaging) {
  config({ path: resolve(process.cwd(), ".env.staging"), override: true });
} else {
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}

const PILOT = "cmplxfg0a000105jrs0gqtwyc";
const OPERATIVE_HOST = "ep-purple-block";

async function main() {
  const { db } = await import("@/lib/db");
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/?]+)/)?.[1] ?? "";
  const isOperative = host.includes(OPERATIVE_HOST);

  const [orgs, props, reservations, site, webBuilderNotes] = await Promise.all([
    db.organization.count(),
    db.property.count({ where: { organizationId: PILOT } }),
    db.reservation.count({ where: { property: { organizationId: PILOT } } }),
    db.tenantWebSite.findUnique({
      where: { organizationId: PILOT },
      select: {
        id: true,
        slug: true,
        status: true,
        bookingEnabled: true,
        template: true,
        _count: { select: { propertyLinks: true, pages: true, media: true } },
      },
    }),
    db.reservation.count({
      where: {
        property: { organizationId: PILOT },
        internalNotes: { contains: "[WEB_BUILDER]" },
      },
    }),
  ]);

  const units = site
    ? await db.tenantWebSiteProperty.findMany({
        where: { siteId: site.id },
        select: {
          isPublished: true,
          property: { select: { unitNumber: true, organizationId: true } },
        },
      })
    : [];

  console.log(
    JSON.stringify(
      {
        envMode: useStaging ? "staging" : "local/operative-default",
        hostFingerprint: host.replace(/:[^@]*@/, "@").slice(0, 80),
        isOperativeNeon: isOperative,
        writesPerformed: false,
        counts: { orgs, pilotProperties: props, pilotReservations: reservations },
        site: site
          ? {
              slug: site.slug,
              status: site.status,
              bookingEnabled: site.bookingEnabled,
              template: site.template,
              links: site._count.propertyLinks,
              pages: site._count.pages,
              media: site._count.media,
            }
          : null,
        units: units.map((u) => ({
          unit: u.property.unitNumber,
          published: u.isPublished,
          orgOk: u.property.organizationId === PILOT,
        })),
        webBuilderReservationNotes: webBuilderNotes,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
