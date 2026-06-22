export type MockSalesAnalytics = {
  generatedProspects: number;
  qualifiedProspects: number;
  contactedProspects: number;
  customers: number;
  conversionRate: number;
};

export const MOCK_SALES_ANALYTICS: MockSalesAnalytics = {
  generatedProspects: 500,
  qualifiedProspects: 180,
  contactedProspects: 50,
  customers: 6,
  conversionRate: 12,
};
