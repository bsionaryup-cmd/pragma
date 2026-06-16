import { AirbnbEmailEventKind } from "@prisma/client";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

/** Production-derived fixture: Yuly CONFIRMED wrongly linked to Karla. */
export const FIXTURE_YULY_AUDIT_SIGNALS: ExtractedReservationSignals = {
  confirmationCode: "HMCNCARK3K",
  checkIn: "2026-06-15",
  checkOut: "2026-06-18",
  guestName: "Yuly Correa",
  hostPayoutAmount: 310122.68,
  guestTotalPaid: 380262,
  netPayout: 0,
  currency: "COP",
  nightCount: 3,
  adultCount: 3,
};

/** Production-derived fixture: Jairo CONFIRMED wrongly linked to Alexander. */
export const FIXTURE_JAIRO_AUDIT_SIGNALS: ExtractedReservationSignals = {
  confirmationCode: "HMZMZBDTKN",
  checkIn: "2026-06-23",
  checkOut: "2026-06-27",
  guestName: "Jairo Tapia",
  hostPayoutAmount: 433686.66,
  guestTotalPaid: 531772,
  currency: "COP",
  nightCount: 4,
};

export const LINKAGE_REPAIR_RESERVATION_IDS = {
  yuly: "cmqfv2qsi000004kz8fcg1xj1",
  karla: "cmpnc1v7e000004juw7z33cz8",
  jairo: "cmqfjayyy000004jlnndtd4qi",
  alexander: "cmqegpzso000004if34la52oo",
  milena: "cmpmqfh1a000104jm8upw39ka",
} as const;

export const LINKAGE_REPAIR_EVENT_IDS = {
  yulyOnKarla: "cmqfutw30000404l2t4pwaluz",
  jairoOnAlexander: "cmqfbg8hn000104jr42xegjsu",
  alexanderConfirmed: "cmqer4hz8000104jxzkqsk79f",
} as const;

export const LINKAGE_REPAIR_AUDIT_IDS = {
  yuly: "cmqfutvyk000304l2bycg9sfd",
  jairo: "cmqfbg8dj000004jr1fq26zjl",
  alexander: "cmqer4hmi000004jx9l8ieic7",
} as const;

export type SimulatedReservation = {
  id: string;
  guestName: string;
  guestFirstName: string;
  guestLastName: string | null;
  reservationCode: string | null;
  totalAmount: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  propertyId: string;
  guestRegistrationCompletedAt: string | null;
  events: Array<{
    id: string;
    auditId: string;
    reservationId: string;
    eventKind: AirbnbEmailEventKind;
    confirmationCode: string | null;
    enrichedFields: Record<string, string | number>;
  }>;
  audits: Array<{
    id: string;
    reservationId: string;
    classification: AirbnbEmailEventKind;
    parsedPayload: { signals: ExtractedReservationSignals };
  }>;
};

export function createLinkageRepairScenarioState(): Map<string, SimulatedReservation> {
  const propertyUrba = "cmpmqijw0000204jv24dur0i7";
  const propertyMilena = "cmpmqfgrs000004jm3a2k4ky2";

  return new Map([
    [
      LINKAGE_REPAIR_RESERVATION_IDS.yuly,
      {
        id: LINKAGE_REPAIR_RESERVATION_IDS.yuly,
        guestName: "Yuly Escarley Correa cordero",
        guestFirstName: "Yuly Escarley",
        guestLastName: "Correa cordero",
        reservationCode: null,
        totalAmount: 0,
        currency: "COP",
        checkIn: "2026-06-15",
        checkOut: "2026-06-18",
        propertyId: propertyUrba,
        guestRegistrationCompletedAt: "2026-06-16T00:10:12.994Z",
        events: [],
        audits: [],
      },
    ],
    [
      LINKAGE_REPAIR_RESERVATION_IDS.karla,
      {
        id: LINKAGE_REPAIR_RESERVATION_IDS.karla,
        guestName: "Huésped Airbnb",
        guestFirstName: "Huésped",
        guestLastName: "Airbnb",
        reservationCode: "HM4SPXSTS2",
        totalAmount: 247421,
        currency: "COP",
        checkIn: "2026-06-18",
        checkOut: "2026-06-23",
        propertyId: propertyUrba,
        guestRegistrationCompletedAt: null,
        events: [
          {
            id: LINKAGE_REPAIR_EVENT_IDS.yulyOnKarla,
            auditId: LINKAGE_REPAIR_AUDIT_IDS.yuly,
            reservationId: LINKAGE_REPAIR_RESERVATION_IDS.karla,
            eventKind: AirbnbEmailEventKind.CONFIRMED,
            confirmationCode: "HMCNCARK3K",
            enrichedFields: {
              guestName: "Karla Durán",
              hostPayoutAmount: 310122.68,
              guestTotalPaid: 380262,
            },
          },
        ],
        audits: [
          {
            id: LINKAGE_REPAIR_AUDIT_IDS.yuly,
            reservationId: LINKAGE_REPAIR_RESERVATION_IDS.karla,
            classification: AirbnbEmailEventKind.CONFIRMED,
            parsedPayload: { signals: FIXTURE_YULY_AUDIT_SIGNALS },
          },
        ],
      },
    ],
    [
      LINKAGE_REPAIR_RESERVATION_IDS.jairo,
      {
        id: LINKAGE_REPAIR_RESERVATION_IDS.jairo,
        guestName: "Huésped Airbnb",
        guestFirstName: "Huésped",
        guestLastName: "Airbnb",
        reservationCode: "HMZMZBDTKN",
        totalAmount: 433686.66,
        currency: "COP",
        checkIn: "2026-06-23",
        checkOut: "2026-06-27",
        propertyId: propertyUrba,
        guestRegistrationCompletedAt: null,
        events: [],
        audits: [],
      },
    ],
    [
      LINKAGE_REPAIR_RESERVATION_IDS.alexander,
      {
        id: LINKAGE_REPAIR_RESERVATION_IDS.alexander,
        guestName: "Huésped Airbnb",
        guestFirstName: "Huésped",
        guestLastName: "Airbnb",
        reservationCode: "HMT2SW2RA9",
        totalAmount: 330242.19,
        currency: "COP",
        checkIn: "2026-06-27",
        checkOut: "2026-06-30",
        propertyId: propertyUrba,
        guestRegistrationCompletedAt: null,
        events: [
          {
            id: LINKAGE_REPAIR_EVENT_IDS.alexanderConfirmed,
            auditId: LINKAGE_REPAIR_AUDIT_IDS.alexander,
            reservationId: LINKAGE_REPAIR_RESERVATION_IDS.alexander,
            eventKind: AirbnbEmailEventKind.CONFIRMED,
            confirmationCode: "HMT2SW2RA9",
            enrichedFields: {
              guestName: "Alexander Roblero",
              hostPayoutAmount: 330242.19,
            },
          },
          {
            id: LINKAGE_REPAIR_EVENT_IDS.jairoOnAlexander,
            auditId: LINKAGE_REPAIR_AUDIT_IDS.jairo,
            reservationId: LINKAGE_REPAIR_RESERVATION_IDS.alexander,
            eventKind: AirbnbEmailEventKind.CONFIRMED,
            confirmationCode: "HMZMZBDTKN",
            enrichedFields: {
              guestName: "Jairo Tapia",
              hostPayoutAmount: 433686.66,
            },
          },
        ],
        audits: [
          {
            id: LINKAGE_REPAIR_AUDIT_IDS.jairo,
            reservationId: LINKAGE_REPAIR_RESERVATION_IDS.alexander,
            classification: AirbnbEmailEventKind.CONFIRMED,
            parsedPayload: { signals: FIXTURE_JAIRO_AUDIT_SIGNALS },
          },
        ],
      },
    ],
    [
      LINKAGE_REPAIR_RESERVATION_IDS.milena,
      {
        id: LINKAGE_REPAIR_RESERVATION_IDS.milena,
        guestName: "Milena Barrero",
        guestFirstName: "Milena",
        guestLastName: "Barrero",
        reservationCode: null,
        totalAmount: 0,
        currency: "COP",
        checkIn: "2026-06-15",
        checkOut: "2026-06-18",
        propertyId: propertyMilena,
        guestRegistrationCompletedAt: "2026-06-10T19:38:52.120Z",
        events: [],
        audits: [],
      },
    ],
  ]);
}
