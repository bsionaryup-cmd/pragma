import "server-only";

import {
  createToolRegistry,
  type ConciergeToolRegistry,
} from "@/modules/ai-concierge/tools/registry";
import { createReadToolHandlers } from "@/modules/ai-concierge/tools/read/handlers";
import type { ConciergeToolExecutionContext } from "@/modules/ai-concierge/tools/read/context";

/**
 * Registry Fase 6: catálogo + handlers de lectura cableados al scope del tenant.
 */
export function createPhase6ReadToolRegistry(
  ctx: ConciergeToolExecutionContext,
): ConciergeToolRegistry {
  const registry = createToolRegistry();
  const handlers = createReadToolHandlers(ctx);
  for (const [name, handler] of Object.entries(handlers)) {
    registry.registerHandler(name, handler);
  }
  return registry;
}
