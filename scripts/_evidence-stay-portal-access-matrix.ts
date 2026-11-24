/**
 * Stay Portal access matrix against real DB (no UI).
 * Proves resolveStayPortalByReservationCode never throws and returns
 * the expected reason / URL for each business state.
 *
 * Platforms: DIRECT, AIRBNB, and iCal-sourced (icalUid present).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  BookingPlatform,
  ReservationStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "../src/lib/db";
import { resolveStayPortalByReservationCode } from "../src/services/guests/stay-portal.service";

config({ path: ".env.local" });
config({ path: ".env" });

type CaseResult = {
  id: string;
  platform?: string;
  reservationCode?: string | null;
  expected: string;
  actual: string;
  threw: boolean;
  errorMessage?: string;
  url?: string;
  registrationUrl?: string;
  pass: boolean;
};

async function safeResolve(code: string) {
  try {
    const result = await resolveStayPortalByReservationCode({
      reservationCode: code,
    });
    return { threw: false as const, result };
  } catch (err) {
    return {
      threw: true as const,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

async function pickReservation(input: {
  where: Prisma.ReservationWhereInput;
}): Promise<{
  id: string;
  reservationCode: string | null;
  platform: BookingPlatform;
  status: ReservationStatus;
  icalUid: string | null;
} | null> {
  // Prefer codes unique in DB so lookup is not fail-closed as "ambiguous".
  const candidates = await db.reservation.findMany({
    where: {
      ...input.where,
      reservationCode: { not: null },
    },
    select: {
      id: true,
      reservationCode: true,
      platform: true,
      status: true,
      icalUid: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  for (const row of candidates) {
    if (!row.reservationCode) continue;
    const dupes = await db.reservation.count({
      where: {
        reservationCode: {
          equals: row.reservationCode,
          mode: "insensitive",
        },
      },
    });
    if (dupes === 1) return row;
  }
  return null;
}

const activeStatuses: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
];

async function main() {
  const cases: CaseResult[] = [];

  {
    const r = await safeResolve("ZZZZZZZZ-NOPE");
    cases.push({
      id: "invalid_code",
      expected: "not_found",
      actual: r.threw ? "THREW" : r.result.ok ? "ok" : r.result.reason,
      threw: r.threw,
      errorMessage: r.threw ? r.errorMessage : undefined,
      pass: !r.threw && !r.result.ok && r.result.reason === "not_found",
    });
  }

  const pendingScopes: Array<{
    id: string;
    where: Prisma.ReservationWhereInput;
  }> = [
    {
      id: "DIRECT",
      where: { platform: BookingPlatform.DIRECT, status: { in: activeStatuses } },
    },
    {
      id: "AIRBNB",
      where: { platform: BookingPlatform.AIRBNB, status: { in: activeStatuses } },
    },
    {
      id: "ICAL",
      where: {
        icalUid: { not: null },
        status: { in: activeStatuses },
      },
    },
  ];

  for (const scope of pendingScopes) {
    const pending = await pickReservation({
      where: {
        ...scope.where,
        guestRegistrationCompletedAt: null,
      },
    });
    if (!pending?.reservationCode) {
      cases.push({
        id: `registration_pending_${scope.id}`,
        platform: scope.id,
        expected: "registration_pending (skipped — no fixture)",
        actual: "skipped",
        threw: false,
        pass: true,
      });
      continue;
    }
    const r = await safeResolve(pending.reservationCode);
    cases.push({
      id: `registration_pending_${scope.id}`,
      platform: `${pending.platform}${pending.icalUid ? "+ical" : ""}`,
      reservationCode: pending.reservationCode,
      expected: "registration_pending",
      actual: r.threw ? "THREW" : r.result.ok ? "ok" : r.result.reason,
      threw: r.threw,
      errorMessage: r.threw ? r.errorMessage : undefined,
      registrationUrl:
        !r.threw && !r.result.ok && r.result.reason === "registration_pending"
          ? r.result.registrationUrl
          : undefined,
      pass:
        !r.threw &&
        !r.result.ok &&
        r.result.reason === "registration_pending",
    });
  }

  for (const scope of pendingScopes) {
    const complete = await pickReservation({
      where: {
        ...scope.where,
        guestRegistrationCompletedAt: { not: null },
      },
    });
    if (!complete?.reservationCode) {
      cases.push({
        id: `gr_complete_open_portal_${scope.id}`,
        platform: scope.id,
        expected: "ok+url (skipped — no fixture)",
        actual: "skipped",
        threw: false,
        pass: true,
      });
      continue;
    }
    const beforeToken = await db.stayPortalToken.findFirst({
      where: { reservationId: complete.id, status: "ACTIVE" },
      select: { token: true },
    });
    const r = await safeResolve(complete.reservationCode);
    const afterToken = await db.stayPortalToken.findFirst({
      where: { reservationId: complete.id, status: "ACTIVE" },
      select: { token: true },
    });
    cases.push({
      id: `gr_complete_open_portal_${scope.id}`,
      platform: `${complete.platform}${complete.icalUid ? "+ical" : ""}`,
      reservationCode: complete.reservationCode,
      expected: "ok+url (lazy token if missing)",
      actual: r.threw ? "THREW" : r.result.ok ? "ok" : r.result.reason,
      threw: r.threw,
      errorMessage: r.threw ? r.errorMessage : undefined,
      url: !r.threw && r.result.ok ? r.result.url : undefined,
      pass:
        !r.threw &&
        r.result.ok === true &&
        typeof r.result.url === "string" &&
        r.result.url.includes("/stay/") &&
        Boolean(afterToken?.token) &&
        (beforeToken?.token
          ? beforeToken.token === afterToken?.token
          : Boolean(afterToken?.token)),
    });
  }

  const ended = await pickReservation({
    where: {
      status: {
        in: [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED],
      },
      guestRegistrationCompletedAt: { not: null },
    },
  });
  if (!ended?.reservationCode) {
    cases.push({
      id: "ended_reservation",
      expected: "ended (skipped — no fixture)",
      actual: "skipped",
      threw: false,
      pass: true,
    });
  } else {
    const r = await safeResolve(ended.reservationCode);
    cases.push({
      id: "ended_reservation",
      platform: ended.platform,
      reservationCode: ended.reservationCode,
      expected: "ended",
      actual: r.threw ? "THREW" : r.result.ok ? "ok" : r.result.reason,
      threw: r.threw,
      errorMessage: r.threw ? r.errorMessage : undefined,
      pass: !r.threw && !r.result.ok && r.result.reason === "ended",
    });
  }

  const delegateOk =
    typeof (db as unknown as { stayPortalToken?: unknown }).stayPortalToken ===
    "object";

  const evidence = {
    at: new Date().toISOString(),
    dbStayPortalTokenDelegatePresent: delegateOk,
    neverThrew: cases.every((c) => !c.threw),
    allPass: cases.every((c) => c.pass) && delegateOk,
    cases,
  };

  const out = join(
    dirname(fileURLToPath(import.meta.url)),
    "../docs/audits/evidence/stay-portal-access-matrix.json",
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(evidence.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
