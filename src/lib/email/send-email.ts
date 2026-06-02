export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export function resolveEmailFromAddress(): string {
  const billingEmail = process.env.PRAGMA_BILLING_EMAIL?.trim();
  return (
    process.env.EMAIL_FROM?.trim() ||
    `PRAGMA Facturación <${billingEmail ?? "facturacion@pragma.co"}>`
  );
}

/** Production/staging hosts where simulated delivery must never count as sent. */
export function isProductionEmailRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production"
  );
}

/**
 * Simulated delivery is allowed only outside production (local dev / tests).
 * In production, missing RESEND_API_KEY always yields sendEmail ok: false.
 */
export function shouldSimulateEmailDelivery(): boolean {
  if (isProductionEmailRuntime()) return false;
  return !process.env.RESEND_API_KEY?.trim();
}

export async function sendEmail(input: SendEmailInput): Promise<{
  ok: boolean;
  message: string;
  id?: string;
}> {
  const to = input.to.trim().toLowerCase();

  if (!to) {
    return { ok: false, message: "Destinatario de correo inválido" };
  }

  if (shouldSimulateEmailDelivery()) {
    console.info("[email] Simulado (RESEND_API_KEY ausente)", {
      from: resolveEmailFromAddress(),
      to,
      subject: input.subject,
    });
    return { ok: true, message: "Correo simulado", id: "simulated" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY no configurada (producción)");
    return {
      ok: false,
      message: "RESEND_API_KEY no configurada",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolveEmailFromAddress(),
        to: [to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    const payload = (await response.json()) as { id?: string; message?: string };

    if (!response.ok) {
      console.error("[email] Resend error:", payload.message ?? response.status);
      return {
        ok: false,
        message: payload.message ?? "No se pudo enviar el correo",
      };
    }

    return {
      ok: true,
      message: "Correo enviado",
      id: payload.id,
    };
  } catch (error) {
    console.error("[email] send failed:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al enviar correo",
    };
  }
}
