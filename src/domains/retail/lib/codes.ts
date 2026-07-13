function generateCode(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

export function generateSaleCode(): string {
  return generateCode("V");
}

export function generatePurchaseCode(): string {
  return generateCode("C");
}
