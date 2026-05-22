import type { BillingInvoice, BillingPlanCode } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import { pragmaEmailFooterHtml, pragmaEmailHeaderHtml } from "@/lib/brand-email";
import { BRAND } from "@/lib/brand";
import { BILLING_ACCOUNT_SINGLETON } from "@/modules/billing/domain/constants";
import { getPlanDefinition } from "@/modules/billing/domain/plan-catalog";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";

export type BillingReceiptPaymentMethod = "online" | "bank_transfer";

export type SendBillingReceiptEmailInput = {
  invoiceId: string;
  paymentMethod: BillingReceiptPaymentMethod;
  paymentReference?: string | null;
};

const MONTH_FORMAT = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeZone: "America/Bogota",
});

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString("es-CO")} ${currency}`;
}

function formatPeriodLabel(start: Date, end: Date) {
  const startLabel = MONTH_FORMAT.format(start);
  const endLabel = MONTH_FORMAT.format(end);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

function paymentMethodLabel(method: BillingReceiptPaymentMethod) {
  return method === "bank_transfer" ? "Transferencia bancaria" : "Pago en línea";
}

function resolveRecipientName(firstName: string | null, lastName: string | null) {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || "Cliente PRAGMA";
}

function isInvoiceEmailColumnMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2022";
}

async function wasReceiptEmailSent(invoiceId: string): Promise<boolean> {
  try {
    const invoice = await db.billingInvoice.findFirst({
      where: { id: invoiceId },
      select: { invoiceEmailSentAt: true },
    });
    return Boolean(invoice?.invoiceEmailSentAt);
  } catch (error) {
    if (isInvoiceEmailColumnMissing(error)) return false;
    throw error;
  }
}

async function markReceiptEmailSent(invoiceId: string): Promise<boolean> {
  try {
    const updated = await db.billingInvoice.updateMany({
      where: {
        id: invoiceId,
        status: "PAID",
        invoiceEmailSentAt: null,
      },
      data: { invoiceEmailSentAt: new Date() },
    });
    return updated.count === 1;
  } catch (error) {
    if (isInvoiceEmailColumnMissing(error)) return false;
    throw error;
  }
}

async function resolveBillingRecipient(organizationId?: string | null) {
  const admin = await db.user.findFirst({
    where: {
      role: "ADMIN",
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { email: true, firstName: true, lastName: true },
  });

  if (admin?.email) return admin;

  const fallbackEmail = process.env.PRAGMA_BILLING_EMAIL?.trim();
  if (fallbackEmail) {
    return { email: fallbackEmail, firstName: null, lastName: null };
  }

  return null;
}

function buildReceiptHtml(input: {
  recipientName: string;
  invoice: BillingInvoice;
  plan: BillingPlanCode;
  periodStart: Date;
  periodEnd: Date;
  paymentMethod: BillingReceiptPaymentMethod;
  paymentReference?: string | null;
}) {
  const plan = getPlanDefinition(input.plan);
  const amount = Number(input.invoice.amount);
  const paidAt = input.invoice.paidAt ?? new Date();
  const periodLabel = formatPeriodLabel(input.periodStart, input.periodEnd);
  const invoiceNumber = input.invoice.id.slice(-8).toUpperCase();

  const rows = [
    {
      label: `Suscripción ${plan.name} — ${periodLabel}`,
      amount,
    },
  ]
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#111827">${item.label}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111827">${formatMoney(item.amount, input.invoice.currency)}</td>
        </tr>
      `,
    )
    .join("");

  const features = plan.features
    .map((feature) => `<li style="margin:0 0 6px;color:#374151">${feature}</li>`)
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
      <body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d9dee5;border-radius:16px;padding:32px">
          ${pragmaEmailHeaderHtml()}
          <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3">Factura de suscripción</h1>
          <p style="margin:0 0 24px;color:#6b7280;line-height:1.5">
            Hola ${input.recipientName}, recibimos tu pago. Este es el detalle de tu facturación mensual.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px">
            <tr>
              <td style="padding:16px">
                <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280">Resumen</p>
                <p style="margin:0 0 4px"><strong>Factura:</strong> #${invoiceNumber}</p>
                <p style="margin:0 0 4px"><strong>Período:</strong> ${periodLabel}</p>
                <p style="margin:0 0 4px"><strong>Fecha de pago:</strong> ${DATE_FORMAT.format(paidAt)}</p>
                <p style="margin:0 0 4px"><strong>Plan:</strong> ${plan.name}</p>
                <p style="margin:0"><strong>Método de pago:</strong> ${paymentMethodLabel(input.paymentMethod)}</p>
                ${
                  input.paymentReference
                    ? `<p style="margin:8px 0 0"><strong>Referencia:</strong> ${input.paymentReference}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">
            <thead>
              <tr>
                <th align="left" style="padding:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280">Concepto</th>
                <th align="right" style="padding:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr>
                <td style="padding:16px 0 0;font-size:16px;font-weight:700">Total pagado</td>
                <td style="padding:16px 0 0;text-align:right;font-size:16px;font-weight:700;color:#0E9F8D">${formatMoney(amount, input.invoice.currency)}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin:24px 0;padding:16px;background:#eaf4ff;border-radius:12px">
            <p style="margin:0 0 8px;font-weight:600">Incluye en tu plan ${plan.name}</p>
            <ul style="margin:0;padding-left:18px">${features}</ul>
          </div>

          <p style="margin:0;color:#6b7280;line-height:1.5;font-size:14px">
            Tu suscripción a ${BRAND.productName} queda activa para el período indicado.
            Si tienes dudas, responde a este correo o escribe a soporte.
          </p>

          ${pragmaEmailFooterHtml()}
        </div>
      </body>
    </html>
  `.trim();
}

function buildReceiptText(input: {
  recipientName: string;
  invoice: BillingInvoice;
  plan: BillingPlanCode;
  periodStart: Date;
  periodEnd: Date;
  paymentMethod: BillingReceiptPaymentMethod;
  paymentReference?: string | null;
}) {
  const plan = getPlanDefinition(input.plan);
  const amount = Number(input.invoice.amount);
  const paidAt = input.invoice.paidAt ?? new Date();
  const periodLabel = formatPeriodLabel(input.periodStart, input.periodEnd);

  return [
    `Hola ${input.recipientName},`,
    "",
    "Recibimos tu pago. Detalle de tu facturación mensual:",
    "",
    `Factura: #${input.invoice.id.slice(-8).toUpperCase()}`,
    `Período: ${periodLabel}`,
    `Fecha de pago: ${DATE_FORMAT.format(paidAt)}`,
    `Plan: ${plan.name}`,
    `Método de pago: ${paymentMethodLabel(input.paymentMethod)}`,
    input.paymentReference ? `Referencia: ${input.paymentReference}` : null,
    "",
    `Concepto: Suscripción ${plan.name} — ${periodLabel}`,
    `Total pagado: ${formatMoney(amount, input.invoice.currency)}`,
    "",
    `Incluye: ${plan.features.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBillingReceiptEmailContent(input: {
  recipientName: string;
  invoice: BillingInvoice;
  plan: BillingPlanCode;
  periodStart: Date;
  periodEnd: Date;
  paymentMethod: BillingReceiptPaymentMethod;
  paymentReference?: string | null;
}) {
  const paidAt = input.invoice.paidAt ?? new Date();
  const periodLabel = formatPeriodLabel(input.periodStart, input.periodEnd);
  const html = buildReceiptHtml(input);
  const text = buildReceiptText(input);

  return {
    subject: `Factura PRAGMA — ${periodLabel}`,
    html,
    text,
    periodLabel,
    paidAt,
  };
}

export function sendBillingReceiptEmailPreview(input: {
  invoice: BillingInvoice;
  plan: BillingPlanCode;
  periodStart: Date;
  periodEnd: Date;
  paymentMethod: BillingReceiptPaymentMethod;
  paymentReference?: string | null;
  recipientName: string;
}) {
  return buildBillingReceiptEmailContent(input);
}

export async function sendBillingReceiptEmail(
  input: SendBillingReceiptEmailInput,
): Promise<{ ok: boolean; message: string }> {
  if (await wasReceiptEmailSent(input.invoiceId)) {
    return { ok: true, message: "Correo de factura ya enviado" };
  }

  const invoice = await db.billingInvoice.findFirst({
    where: { id: input.invoiceId },
  });

  if (!invoice || invoice.status !== "PAID") {
    return { ok: false, message: "Factura no pagada" };
  }

  const account = await db.billingAccount.findUnique({
    where: { id: invoice.billingAccountId },
  });
  const recipient = await resolveBillingRecipient(account?.organizationId);

  if (invoice.invoiceEmailSentAt) {
    return { ok: true, message: "Correo de factura ya enviado" };
  }

  if (!recipient?.email) {
    console.error("[billing] receipt email: no recipient configured");
    return { ok: false, message: "No hay correo de facturación registrado" };
  }

  const paidAt = invoice.paidAt ?? new Date();
  const periodEnd =
    account?.currentPeriodEnd ??
    new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const plan = account?.plan ?? "STARTER";
  const recipientName = resolveRecipientName(
    recipient.firstName,
    recipient.lastName,
  );

  const { subject, html, text } = buildBillingReceiptEmailContent({
    recipientName,
    invoice,
    plan,
    periodStart: paidAt,
    periodEnd,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference,
  });

  const result = await sendEmail({
    to: recipient.email,
    subject,
    html,
    text,
  });

  if (!result.ok) {
    await writePaymentAuditLog({
      entityType: "billing_invoice",
      entityId: invoice.id,
      action: "invoice_email_failed",
      after: {
        to: recipient.email,
        paymentMethod: input.paymentMethod,
        error: result.message,
      },
    });
    return result;
  }

  const marked = await markReceiptEmailSent(invoice.id);
  if (!marked && (await wasReceiptEmailSent(invoice.id))) {
    return { ok: true, message: "Correo de factura ya enviado" };
  }

  await writePaymentAuditLog({
    entityType: "billing_invoice",
    entityId: invoice.id,
    action: "invoice_email_sent",
    after: {
      to: recipient.email,
      emailId: result.id ?? null,
      paymentMethod: input.paymentMethod,
    },
  });

  return result;
}

/** Fire-and-forget: never blocks payment activation. */
export function queueBillingReceiptEmail(input: SendBillingReceiptEmailInput) {
  void sendBillingReceiptEmail(input)
    .then((result) => {
      if (!result.ok) {
        console.error("[billing] receipt email not sent:", result.message, {
          invoiceId: input.invoiceId,
        });
      }
    })
    .catch((error) => {
      console.error("[billing] receipt email failed:", error);
    });
}
