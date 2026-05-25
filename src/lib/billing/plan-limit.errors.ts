import type { BillingPlanCode } from "@prisma/client";

export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT" as const;

  constructor(
    message: string,
    readonly upgradePlan?: BillingPlanCode,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export function isPlanLimitError(error: unknown): error is PlanLimitError {
  return error instanceof PlanLimitError;
}
