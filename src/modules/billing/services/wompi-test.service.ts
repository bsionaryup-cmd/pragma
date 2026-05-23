import type { WompiConfig } from "@/modules/billing/config/wompi.config";
import { recordWompiHealthCheck } from "@/modules/billing/services/wompi-persistence";

export async function testWompiConnection(input: {
  organizationId: string;
  config: WompiConfig;
}): Promise<{ ok: boolean; message: string }> {
  const { config, organizationId } = input;

  if (!config.publicKey || !config.privateKey) {
    return {
      ok: false,
      message: "Credenciales incompletas para probar la conexión",
    };
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/merchants/${encodeURIComponent(config.publicKey)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.privateKey}`,
        },
        cache: "no-store",
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      data?: { name?: string; email?: string };
      error?: { reason?: string; type?: string };
    } | null;

    if (!response.ok) {
      const message =
        payload?.error?.reason ??
        payload?.error?.type ??
        `Wompi respondió con HTTP ${response.status}`;
      await recordWompiHealthCheck(organizationId, { ok: false, message });
      return { ok: false, message };
    }

    const merchantName = payload?.data?.name?.trim();
    await recordWompiHealthCheck(organizationId, { ok: true });
    return {
      ok: true,
      message: merchantName
        ? `Conexión exitosa con ${merchantName}`
        : "Conexión con Wompi verificada",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo contactar a Wompi";
    await recordWompiHealthCheck(organizationId, { ok: false, message });
    return { ok: false, message };
  }
}
