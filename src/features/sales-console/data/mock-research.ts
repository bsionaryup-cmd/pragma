import type { ProspectSegment } from "@/features/sales-console/types/prospect";

export type MockResearch = {
  id: string;
  prospectId: string;
  companyName: string;
  segment: ProspectSegment;
  estimatedProperties: number;
  currentStack: string[];
  painPoints: string[];
  recommendedPositioning: string;
};

export const MOCK_RESEARCH: MockResearch[] = [
  {
    id: "research-wehost",
    prospectId: "prospect-wehost",
    companyName: "WeHost Colombia",
    segment: "PROPERTY_MANAGER",
    estimatedProperties: 120,
    currentStack: ["Guesty", "PriceLabs"],
    painPoints: [
      "Fragmented operations across tools",
      "Manual check-ins and guest messaging",
    ],
    recommendedPositioning: "Unified PMS + automation for property managers",
  },
  {
    id: "research-casacol",
    prospectId: "prospect-casacol",
    companyName: "Casacol",
    segment: "PROPERTY_MANAGER",
    estimatedProperties: 300,
    currentStack: ["Lodgify", "Stripe", "WhatsApp"],
    painPoints: [
      "High volume of owner reporting requests",
      "Limited visibility across portfolios",
    ],
    recommendedPositioning: "Enterprise operations hub with owner dashboards",
  },
];

export function findMockResearch(prospectId: string): MockResearch | undefined {
  return MOCK_RESEARCH.find((row) => row.prospectId === prospectId);
}
