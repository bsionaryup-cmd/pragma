import "server-only";

import { countMobilityAllies } from "@/modules/qr-mobility/services/mobility-ally.service";
import { countMobilityServices } from "@/modules/qr-mobility/services/mobility-service.service";

export type MobilityDashboardStats = {
  totalAllies: number;
  totalServices: number;
  totalQr: number;
  totalReservations: number;
};

export async function getMobilityDashboardStats(): Promise<MobilityDashboardStats> {
  const [totalAllies, totalServices] = await Promise.all([
    countMobilityAllies(),
    countMobilityServices(),
  ]);

  return {
    totalAllies,
    totalServices,
    totalQr: totalAllies,
    totalReservations: 0,
  };
}
