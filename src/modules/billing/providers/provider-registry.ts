import type { PaymentProviderAdapter } from "@/modules/billing/providers/payment-provider";
import { wompiAdapter } from "@/modules/billing/providers/wompi/wompi.adapter";

const registry: Record<string, PaymentProviderAdapter> = {
  WOMPI: wompiAdapter,
};

export function getPaymentProvider(code: keyof typeof registry = "WOMPI") {
  const provider = registry[code];
  if (!provider) throw new Error(`Proveedor no registrado: ${code}`);
  return provider;
}

export function listRegisteredProviders(): PaymentProviderAdapter[] {
  return Object.values(registry);
}
