import { Webhook } from "svix";

const RESEND_FETCH_TIMEOUT_MS = 20_000;

export type ResendReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html: string | null;
  text: string | null;
  message_id?: string | null;
  created_at?: string;
};

export type ResendInboundWebhookEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    message_id?: string;
    created_at?: string;
  };
};

export function isResendInboundConfigured(): boolean {
  return Boolean(process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim());
}

export function verifyResendInboundWebhook(
  rawBody: string,
  headers: {
    svixId: string | null;
    svixTimestamp: string | null;
    svixSignature: string | null;
  },
): ResendInboundWebhookEvent {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("RESEND_INBOUND_WEBHOOK_SECRET no configurado");
  }

  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
    throw new Error("Headers Svix faltantes");
  }

  const wh = new Webhook(secret);
  return wh.verify(rawBody, {
    "svix-id": headers.svixId,
    "svix-timestamp": headers.svixTimestamp,
    "svix-signature": headers.svixSignature,
  }) as ResendInboundWebhookEvent;
}

export async function fetchResendReceivedEmail(
  emailId: string,
): Promise<ResendReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no configurado");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
    );

    const payload = (await response.json()) as ResendReceivedEmail & {
      message?: string;
    };

    if (!response.ok) {
      throw new Error(
        payload.message ?? "No se pudo obtener el correo recibido",
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timeout obteniendo correo de Resend");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
