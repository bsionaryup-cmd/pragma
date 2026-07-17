import "server-only";

import {
  createToolRegistry,
  type ConciergeToolRegistry,
} from "@/modules/ai-concierge/tools/registry";
import { createReadToolHandlers } from "@/modules/ai-concierge/tools/read/handlers";
import type { ConciergeToolExecutionContext } from "@/modules/ai-concierge/tools/read/context";
import { PLANNED_READ_TOOLS } from "@/modules/ai-concierge/tools/registry";

/**
 * Registry Fase 6: catálogo + handlers de lectura cableados al scope del tenant.
 */
export function createPhase6ReadToolRegistry(
  ctx: ConciergeToolExecutionContext,
): ConciergeToolRegistry {
  const allowed = ctx.allowedTools ?? [];
  const definitions =
    allowed.length > 0
      ? PLANNED_READ_TOOLS.filter((tool) => allowed.includes(tool.name))
      : PLANNED_READ_TOOLS;
  const registry = createToolRegistry(definitions);
  const handlers = createReadToolHandlers(ctx);
  for (const [name, handler] of Object.entries(handlers)) {
    if (registry.getDefinition(name)) {
      registry.registerHandler(name, handler);
    }
  }
  return registry;
}
