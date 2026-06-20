import "server-only";

import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  getNovedadesUnlinkedInquiryDetail,
  listNovedadesUnlinkedInquiryItems,
} from "@/services/novedades/novedades-unlinked-inquiry.service";
import type { ReservationInquiryInboxItem } from "@/features/reservations/types/reservation.types";

export async function listReservationInquiriesForInbox(
  limit = 40,
): Promise<ReservationInquiryInboxItem[]> {
  const scope = await requireTenantDataScope();
  return listNovedadesUnlinkedInquiryItems(scope, limit);
}

export async function getReservationInquiryForInbox(
  pendingActivityId: string,
): Promise<ReservationInquiryInboxItem | null> {
  const scope = await requireTenantDataScope();
  return getNovedadesUnlinkedInquiryDetail(scope, pendingActivityId);
}
