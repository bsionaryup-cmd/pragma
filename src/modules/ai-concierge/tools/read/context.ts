import "server-only";

import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import type { ConciergeToolResult } from "@/modules/ai-concierge/types/tool";

export type ConciergeToolExecutionContext = {
  scope: TenantDataScope;
  /** Vacío = todas las propiedades del tenant; con valores = allowlist estricta. */
  allowedPropertyIds?: string[];
  /** Vacío = catálogo completo; con valores = allowlist estricta. */
  allowedTools?: string[];
  /** Correlación opcional para auditoría. */
  runId?: string;
  conversationId?: string;
};

export type ConciergeToolAuditEntry = {
  at: string;
  toolName: string;
  organizationId: string | null;
  userId: string;
  runId?: string;
  conversationId?: string;
  ok: boolean;
  error?: string;
  summary?: string;
};

const auditBuffer: ConciergeToolAuditEntry[] = [];
const AUDIT_CAP = 200;

export function recordToolAudit(entry: ConciergeToolAuditEntry): void {
  auditBuffer.push(entry);
  if (auditBuffer.length > AUDIT_CAP) {
    auditBuffer.splice(0, auditBuffer.length - AUDIT_CAP);
  }
}

export function listRecentToolAudits(limit = 50): ConciergeToolAuditEntry[] {
  return auditBuffer.slice(-limit);
}

export function okResult(
  data: unknown,
  missingFacts: string[] = [],
): ConciergeToolResult {
  return { ok: true, data, missingFacts };
}

export function failResult(
  error: string,
  missingFacts: string[] = [],
): ConciergeToolResult {
  return { ok: false, error, missingFacts };
}
