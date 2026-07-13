import type {
  MobilityRecordStatus,
  MobilityService,
  MobilityServiceCategory,
} from "@prisma/client";

export type MobilityServiceRow = MobilityService;

export const MOBILITY_SERVICE_CATEGORIES: MobilityServiceCategory[] = [
  "TRANSFER",
  "TOUR",
  "EXPERIENCE",
  "RENTAL",
  "TICKET",
  "OTHER",
];

const CATEGORY_LABELS: Record<MobilityServiceCategory, string> = {
  TRANSFER: "Traslados",
  TOUR: "Tours",
  EXPERIENCE: "Experiencias",
  RENTAL: "Alquileres",
  TICKET: "Entradas",
  OTHER: "Otros",
};

export function formatMobilityServiceCategory(category: MobilityServiceCategory): string {
  return CATEGORY_LABELS[category];
}

export type MobilityServiceFormValues = {
  name: string;
  category: MobilityServiceCategory;
  description: string;
  basePrice: string;
  nightPrice: string;
  holidayPrice: string;
  scheduleText: string;
  status: MobilityRecordStatus;
  sortOrder: string;
  imageUrl: string;
  recommendedVehicle: string;
  maxCapacity: string;
  luggageAllowed: string;
};

export function emptyMobilityServiceFormValues(): MobilityServiceFormValues {
  return {
    name: "",
    category: "TRANSFER",
    description: "",
    basePrice: "",
    nightPrice: "",
    holidayPrice: "",
    scheduleText: "",
    status: "ACTIVE",
    sortOrder: "0",
    imageUrl: "",
    recommendedVehicle: "",
    maxCapacity: "",
    luggageAllowed: "",
  };
}

export function serviceToFormValues(
  service: MobilityServiceRow | SerializedMobilityServiceRow,
): MobilityServiceFormValues {
  return {
    name: service.name,
    category: service.category,
    description: service.description ?? "",
    basePrice: String(Number(service.basePrice)),
    nightPrice: service.nightPrice != null ? String(Number(service.nightPrice)) : "",
    holidayPrice: service.holidayPrice != null ? String(Number(service.holidayPrice)) : "",
    scheduleText: service.scheduleText ?? "",
    status: service.status,
    sortOrder: String(service.sortOrder),
    imageUrl: service.imageUrl ?? "",
    recommendedVehicle: service.recommendedVehicle ?? "",
    maxCapacity: service.maxCapacity != null ? String(service.maxCapacity) : "",
    luggageAllowed: service.luggageAllowed ?? "",
  };
}

export function serializeMobilityServiceForClient(service: MobilityServiceRow) {
  return {
    ...service,
    basePrice: Number(service.basePrice),
    nightPrice: service.nightPrice != null ? Number(service.nightPrice) : null,
    holidayPrice: service.holidayPrice != null ? Number(service.holidayPrice) : null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    deletedAt: service.deletedAt?.toISOString() ?? null,
  };
}

export type SerializedMobilityServiceRow = ReturnType<typeof serializeMobilityServiceForClient>;
