import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function stripFwd(subject) {
  return subject.replace(/^(?:fwd?|fw|reenviado|re):\s*/i, "").trim();
}

const integration = await db.tenantAirbnbEmailIntegration.findUnique({
  where: { organizationId: ORG },
  include: { organization: { select: { id: true, name: true } } },
});

const audits = await db.emailIngestionAudit.findMany({
  where: { organizationId: ORG },
  orderBy: { createdAt: "desc" },
  select: {
    fromAddress: true,
    subject: true,
    toAddress: true,
    classification: true,
    processingStatus: true,
  },
});

const byFrom = new Map();
const byClassification = new Map();
const uniqueSubjects = new Map();

for (const a of audits) {
  byFrom.set(a.fromAddress, (byFrom.get(a.fromAddress) ?? 0) + 1);
  const cls = a.classification ?? "null";
  byClassification.set(cls, (byClassification.get(cls) ?? 0) + 1);
  const key = stripFwd(a.subject).toLowerCase();
  const existing = uniqueSubjects.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    uniqueSubjects.set(key, {
      count: 1,
      classification: a.classification,
      from: a.fromAddress,
    });
  }
}

console.log(
  JSON.stringify(
    {
      tenant: {
        organizationId: ORG,
        organizationName: integration?.organization.name,
        inboundEmailAddress: integration?.inboundEmailAddress,
        enabled: integration?.enabled,
        syncStatus: integration?.syncStatus,
        lastEmailReceivedAt: integration?.lastEmailReceivedAt,
      },
      totalAudits: audits.length,
      toAddresses: [...new Set(audits.map((a) => a.toAddress).filter(Boolean))],
      byFrom: Object.fromEntries(byFrom),
      byClassification: Object.fromEntries(byClassification),
      uniqueSubjects: [...uniqueSubjects.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([subject, meta]) => ({ subject, ...meta })),
    },
    null,
    2,
  ),
);

await db.$disconnect();
await pool.end();
