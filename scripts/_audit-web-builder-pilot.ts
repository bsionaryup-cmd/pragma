import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

async function main() {
  const { db } = await import("@/lib/db");
  const site = await db.tenantWebSite.findUnique({
    where: { slug: "urbanovaloft" },
    include: {
      propertyLinks: {
        include: {
          property: { select: { name: true, unitNumber: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  console.log(
    JSON.stringify(
      {
        slug: site?.slug,
        status: site?.status,
        siteName: site?.siteName,
        props: site?.propertyLinks.map((l) => ({
          name: l.property.name,
          unit: l.property.unitNumber,
          published: l.isPublished,
        })),
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
