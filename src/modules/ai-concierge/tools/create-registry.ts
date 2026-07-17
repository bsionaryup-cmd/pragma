import "server-only";

import {
  createToolRegistry,
  type ConciergeToolRegistry,
} from "@/modules/ai-concierge/tools/registry";
import { PLANNED_READ_TOOLS } from "@/modules/ai-concierge/tools/registry";
import { createReadToolHandlers } from "@/modules/ai-concierge/tools/read/handlers";
import {
  createWriteToolHandlers,
} from "@/modules/ai-concierge/tools/write/handlers";
import { PLANNED_WRITE_TOOLS } from "@/modules/ai-concierge/tools/write/catalog";
import type { ConciergeToolExecutionContext } from "@/modules/ai-concierge/tools/read/context";

export function createConciergeToolRegistry(
  ctx: ConciergeToolExecutionContext,
  options?: { includeWrite?: boolean },
): ConciergeToolRegistry {
  const defs = options?.includeWrite
    ? [...PLANNED_READ_TOOLS, ...PLANNED_WRITE_TOOLS]
    : [...PLANNED_READ_TOOLS];
  const allowed = ctx.allowedTools ?? [];
  const enabledDefs =
    allowed.length > 0
      ? defs.filter((definition) => allowed.includes(definition.name))
      : defs;
  const registry = createToolRegistry(enabledDefs);
  for (const [name, handler] of Object.entries(createReadToolHandlers(ctx))) {
    if (registry.getDefinition(name)) registry.registerHandler(name, handler);
  }
  if (options?.includeWrite) {
    for (const [name, handler] of Object.entries(createWriteToolHandlers(ctx))) {
      if (registry.getDefinition(name)) registry.registerHandler(name, handler);
    }
  }
  return registry;
}
