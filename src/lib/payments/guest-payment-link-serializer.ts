import type { GuestPaymentLink } from "@prisma/client";

/** Plain shape safe for Client Components and Server Action responses. */
export type SerializedGuestPaymentLink = Omit<
  GuestPaymentLink,
  "amount" | "expiresAt" | "createdAt" | "updatedAt"
> & {
  amount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeGuestPaymentLink(
  link: GuestPaymentLink,
): SerializedGuestPaymentLink {
  return {
    ...link,
    amount: Number(link.amount.toString()),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

export type SerializedGuestPaymentLinkForHub = SerializedGuestPaymentLink & {
  reservation: {
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
  } | null;
  property: { id: string; name: string; unitNumber: string | null } | null;
};

export function serializeGuestPaymentLinkForHub(
  link: {
    amount: GuestPaymentLink["amount"];
    expiresAt: GuestPaymentLink["expiresAt"];
    createdAt: GuestPaymentLink["createdAt"];
    updatedAt: GuestPaymentLink["updatedAt"];
    reservation: {
      id: string;
      guestName: string;
      checkIn: Date;
      checkOut: Date;
    } | null;
    property: { id: string; name: string; unitNumber: string | null } | null;
  } & Omit<
    GuestPaymentLink,
    "amount" | "expiresAt" | "createdAt" | "updatedAt" | "reservation" | "property"
  >,
  options?: { displayGuestName?: string | null },
): SerializedGuestPaymentLinkForHub {
  const base = serializeGuestPaymentLink(link as GuestPaymentLink);
  return {
    ...base,
    reservation: link.reservation
      ? {
          id: link.reservation.id,
          guestName:
            options?.displayGuestName?.trim() || link.reservation.guestName,
          checkIn: link.reservation.checkIn.toISOString(),
          checkOut: link.reservation.checkOut.toISOString(),
        }
      : null,
    property: link.property,
  };
}
