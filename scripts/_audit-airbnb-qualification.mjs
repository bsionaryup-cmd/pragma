import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

const token = process.env.APIFY_TOKEN?.trim() || process.env.APIFY_API_TOKEN?.trim();
const actor = "automation-lab~airbnb-listing";

async function apify(path, init) {
  const res = await fetch(`https://api.apify.com/v2${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

if (!token) {
  console.log(JSON.stringify({ error: "no_apify_token" }));
  process.exit(1);
}

const started = await apify(`/acts/${actor}/runs`, {
  method: "POST",
  body: JSON.stringify({
    locationQueries: ["Medellín, Colombia"],
    maxListings: 12,
    skipDetailPages: true,
  }),
});

const runId = started.data?.id;
let items = [];

for (let i = 0; i < 50; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  const run = await apify(`/actor-runs/${runId}`);
  if (run.data?.status === "SUCCEEDED") {
    const ds = run.data.defaultDatasetId;
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${ds}/items?format=json&clean=true&limit=12`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    items = await itemsRes.json();
    break;
  }
  if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.data?.status)) {
    console.log(JSON.stringify({ error: run.data.status }));
    process.exit(1);
  }
}

const arr = Array.isArray(items) ? items : [];
const hosts = new Map();

for (const item of arr) {
  const host = item.host ?? {};
  const name = host.name ?? item.hostName ?? "unknown";
  const key = String(name).toLowerCase().trim();
  const bucket = hosts.get(key) ?? {
    hostName: name,
    listings: 0,
    totalReviews: 0,
    ratings: [],
    superhost: Boolean(host.isSuperHost ?? host.isSuperhost),
    hasAbout: Boolean(host.about?.length),
    hasHighlights: Boolean(host.highlights?.length),
    cities: new Set(),
  };
  bucket.listings += 1;
  const reviews = item.rating?.reviewsCount ?? item.reviewsCount ?? 0;
  const rating = item.rating?.guestSatisfaction ?? item.totalScore ?? null;
  bucket.totalReviews += Number(reviews) || 0;
  if (rating != null) bucket.ratings.push(Number(rating));
  const city = item.city ?? item.address?.split(",")?.[0] ?? null;
  if (city) bucket.cities.add(city);
  hosts.set(key, bucket);
}

const hostSummary = [...hosts.values()]
  .map((h) => ({
    hostName: h.hostName,
    listings: h.listings,
    totalReviews: h.totalReviews,
    avgRating:
      h.ratings.length > 0
        ? Math.round((h.ratings.reduce((a, b) => a + b, 0) / h.ratings.length) * 100) / 100
        : null,
    superhost: h.superhost,
    hasAbout: h.hasAbout,
    hasHighlights: h.hasHighlights,
    cities: [...h.cities],
    portfolioEstimate: h.listings >= 3 ? "PROFESSIONAL_SIGNAL" : "SINGLE_HOST",
  }))
  .sort((a, b) => b.listings - a.listings);

console.log(
  JSON.stringify(
    {
      actor: "automation-lab/airbnb-listing",
      sampleCount: arr.length,
      uniqueHosts: hostSummary.length,
      groupableByHost: hostSummary.length < arr.length || hostSummary.some((h) => h.listings > 1),
      professionalHosts: hostSummary.filter((h) => h.listings >= 2).length,
      fieldsPresent: {
        hostName: arr.filter((i) => i.host?.name).length,
        hostAbout: arr.filter((i) => i.host?.about?.length).length,
        hostHighlights: arr.filter((i) => i.host?.highlights?.length).length,
        superhost: arr.filter((i) => i.host?.isSuperHost ?? i.host?.isSuperhost).length,
        reviews: arr.filter((i) => i.rating?.reviewsCount ?? i.reviewsCount).length,
        city: arr.filter((i) => i.city).length,
        phone: arr.filter((i) => i.phone ?? i.host?.phone).length,
        email: arr.filter((i) => i.email ?? i.host?.email).length,
      },
      hostSummary: hostSummary.slice(0, 5),
      verdict: {
        canGroupHosts: hostSummary.length > 0,
        canEstimatePortfolio: hostSummary.some((h) => h.listings >= 2),
        hasContactData: false,
        readyForIntegration: hostSummary.some((h) => h.listings >= 2) && arr.length >= 5,
        recommendation:
          "Use as QUALIFICATION layer only — attach airbnbScore to existing leads, do not create duplicate host leads until dedup strategy is defined.",
      },
    },
    null,
    2,
  ),
);
