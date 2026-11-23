import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.staging"), override: true });

execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  env: process.env,
});

const statusArg = (process.argv[2] || "DRAFT").toUpperCase();

async function main() {
  const { db } = await import("@/lib/db");
  const { WebSiteStatus } = await import("@prisma/client");
  const status =
    WebSiteStatus[statusArg as keyof typeof WebSiteStatus] ?? WebSiteStatus.DRAFT;

  const site = await db.tenantWebSite.update({
    where: { slug: "urbanovaloft" },
    data: {
      status,
      publishedAt: status === WebSiteStatus.PUBLISHED ? new Date() : null,
      bookingEnabled: true,
    },
  });
  await db.tenantWebPage.updateMany({
    where: { siteId: site.id },
    data: {
      status:
        status === WebSiteStatus.PUBLISHED
          ? WebSiteStatus.PUBLISHED
          : WebSiteStatus.DRAFT,
    },
  });
  console.log(JSON.stringify({ slug: site.slug, status: site.status }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
