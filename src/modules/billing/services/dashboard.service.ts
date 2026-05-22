import {
  getBillingOverview,
  type BillingOverviewDto,
} from "@/services/billing/billing.service";

export type BillingDashboardDto = BillingOverviewDto;

export async function getBillingDashboard(): Promise<BillingDashboardDto> {
  return getBillingOverview();
}
