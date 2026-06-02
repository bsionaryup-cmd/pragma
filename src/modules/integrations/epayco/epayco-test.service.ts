import "server-only";

import { db } from "@/lib/db";
import { epaycoApifyHealthCheck } from "@/modules/integrations/epayco/epayco-apify.client";
import { resolveEpaycoConfig } from "@/modules/integrations/epayco/epayco-credentials";

export async function testEpaycoConnection(
  organizationId: string,
): Promise<{ ok: boolean; message: string }> {
  const config = await resolveEpaycoConfig(organizationId);
  if (!config.publicKey || !config.privateKey) {
    return { ok: false, message: "Credenciales ePayco incompletas" };
  }

  const result = await epaycoApifyHealthCheck({
    publicKey: config.publicKey,
    privateKey: config.privateKey,
    env: config.env ?? "test",
  });

  await db.epaycoIntegration.updateMany({
    where: { organizationId },
    data: {
      lastHealthCheckAt: new Date(),
      lastError: result.ok ? null : result.message,
    },
  });

  return result;
}
