export class BillingModuleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BillingModuleError";
    this.code = code;
  }
}

export class PaymentProviderNotConfiguredError extends BillingModuleError {
  constructor(_provider: string) {
    super(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "El pago en línea no está disponible en este momento. Usa transferencia bancaria o contacta a soporte.",
    );
  }
}

export class WebhookValidationError extends BillingModuleError {
  constructor(message: string) {
    super("WEBHOOK_VALIDATION_FAILED", message);
  }
}
