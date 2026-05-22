import PDFDocument from "pdfkit";
import { BRAND } from "@/lib/brand";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  formatInvoicePeriod,
  type BillingInvoiceDocument,
} from "@/modules/billing/domain/invoice-document";

const BRAND_TEAL = "#0E9F8D";
const BRAND_DARK = "#050A18";
const MUTED = "#6B7280";
const BORDER = "#D9DEE5";

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .text(label.toUpperCase(), x, y, { width });
  doc
    .fontSize(10)
    .fillColor(BRAND_DARK)
    .text(value, x, y + 11, { width });
}

export function generateBillingInvoicePdf(
  document: BillingInvoiceDocument,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    // Header band
    doc
      .rect(left, 48, pageWidth, 4)
      .fill(BRAND_TEAL);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(BRAND_DARK)
      .text("PRAGMA", left, 64);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(BRAND.productName, left, 90)
      .text(BRAND.tagline, left, 102, { width: pageWidth * 0.55 });

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(BRAND_TEAL)
      .text(document.statusLabel, left + pageWidth * 0.55, 64, {
        width: pageWidth * 0.45,
        align: "right",
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(BRAND_DARK)
      .text(document.invoiceNumber, left + pageWidth * 0.55, 84, {
        width: pageWidth * 0.45,
        align: "right",
      });

    if (document.isPreview) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          "Documento de muestra generado desde tu plan actual",
          left + pageWidth * 0.45,
          100,
          { width: pageWidth * 0.55, align: "right" },
        );
    }

    let y = 130;

    // Issuer / Customer blocks
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND_DARK)
      .text("EMISOR", left, y);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND_DARK)
      .text("CLIENTE", left + pageWidth * 0.5, y);

    y += 16;

    const issuerLines = [
      document.issuer.legalName,
      `NIT ${document.issuer.nit}`,
      document.issuer.email,
      document.issuer.address,
    ];
    const customerLines = [
      document.customer.displayName,
      document.customer.companyName
        ? `Empresa: ${document.customer.companyName}`
        : null,
      document.customer.email,
    ].filter(Boolean) as string[];

    doc.font("Helvetica").fontSize(10).fillColor(BRAND_DARK);
    issuerLines.forEach((line, i) => {
      doc.text(line, left, y + i * 14, { width: pageWidth * 0.45 });
    });
    customerLines.forEach((line, i) => {
      doc.text(line, left + pageWidth * 0.5, y + i * 14, {
        width: pageWidth * 0.5,
      });
    });

    y += Math.max(issuerLines.length, customerLines.length) * 14 + 24;

    // Meta grid
    doc
      .rect(left, y, pageWidth, 72)
      .fillAndStroke("#F9FAFB", BORDER);

    const colW = pageWidth / 3;
    const metaY = y + 12;
    drawLabelValue(
      doc,
      "Fecha de emisión",
      formatInvoiceDate(document.issueDate),
      left + 12,
      metaY,
      colW - 16,
    );
    drawLabelValue(
      doc,
      "Fecha de pago",
      document.paidAt ? formatInvoiceDate(document.paidAt) : "—",
      left + colW + 12,
      metaY,
      colW - 16,
    );
    drawLabelValue(
      doc,
      "Período facturado",
      formatInvoicePeriod(document.periodStart, document.periodEnd),
      left + colW * 2 + 12,
      metaY,
      colW - 16,
    );

    drawLabelValue(
      doc,
      "Plan",
      document.plan.name,
      left + 12,
      metaY + 34,
      colW - 16,
    );
    drawLabelValue(
      doc,
      "Método de pago",
      document.paymentMethod,
      left + colW + 12,
      metaY + 34,
      colW - 16,
    );
    drawLabelValue(
      doc,
      "Referencia",
      document.paymentReference ?? "—",
      left + colW * 2 + 12,
      metaY + 34,
      colW - 16,
    );

    y += 88;

    // Line items table header
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(MUTED)
      .text("CONCEPTO", left, y)
      .text("CANT.", left + pageWidth * 0.55, y, { width: 40, align: "right" })
      .text("V. UNIT.", left + pageWidth * 0.65, y, { width: 70, align: "right" })
      .text("SUBTOTAL", left + pageWidth * 0.82, y, { width: 70, align: "right" });

    y += 14;
    doc
      .moveTo(left, y)
      .lineTo(left + pageWidth, y)
      .strokeColor(BORDER)
      .stroke();
    y += 10;

    document.lineItems.forEach((item) => {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(BRAND_DARK)
        .text(item.description, left, y, { width: pageWidth * 0.52 })
        .text(String(item.quantity), left + pageWidth * 0.55, y, {
          width: 40,
          align: "right",
        })
        .text(formatInvoiceMoney(item.unitPrice, document.currency), left + pageWidth * 0.65, y, {
          width: 70,
          align: "right",
        })
        .text(formatInvoiceMoney(item.total, document.currency), left + pageWidth * 0.82, y, {
          width: 70,
          align: "right",
        });
      y += 28;
    });

    y += 8;
    doc
      .moveTo(left + pageWidth * 0.55, y)
      .lineTo(left + pageWidth, y)
      .strokeColor(BORDER)
      .stroke();
    y += 12;

    const totalsX = left + pageWidth * 0.62;
    const totalsValX = left + pageWidth * 0.82;

    doc.font("Helvetica").fontSize(10).fillColor(BRAND_DARK);
    doc.text("Subtotal", totalsX, y, { width: 80, align: "right" });
    doc.text(formatInvoiceMoney(document.subtotal, document.currency), totalsValX, y, {
      width: 70,
      align: "right",
    });
    y += 18;
    doc.text(`IVA (${Math.round(document.taxRate * 100)}%)`, totalsX, y, {
      width: 80,
      align: "right",
    });
    doc.text(formatInvoiceMoney(document.taxAmount, document.currency), totalsValX, y, {
      width: 70,
      align: "right",
    });
    y += 22;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND_TEAL);
    doc.text("Total pagado", totalsX, y, { width: 80, align: "right" });
    doc.text(formatInvoiceMoney(document.total, document.currency), totalsValX, y, {
      width: 70,
      align: "right",
    });

    y += 36;

    // Plan features
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(BRAND_DARK)
      .text(`Incluye en el plan ${document.plan.name}`, left, y);
    y += 16;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    document.plan.features.forEach((feature) => {
      doc.text(`• ${feature}`, left + 8, y, { width: pageWidth - 8 });
      y += 14;
    });

    y += 12;

    // Legal footer
    doc
      .rect(left, y, pageWidth, 64)
      .fillAndStroke("#EAF4FF", BORDER);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        [
          "Documento de soporte de pago por suscripción a software como servicio (SaaS) — PRAGMA PMS.",
          "Los valores incluyen IVA cuando aplica según normativa colombiana vigente.",
          "Para soporte de facturación escriba a " + document.issuer.email + ".",
          document.isPreview
            ? "Vista previa generada automáticamente; no sustituye documento fiscal electrónico si aplica."
            : "Gracias por confiar en PRAGMA para la gestión de tu operación.",
        ].join("\n"),
        left + 12,
        y + 10,
        { width: pageWidth - 24, lineGap: 2 },
      );

    doc.end();
  });
}

export function billingInvoicePdfFilename(document: BillingInvoiceDocument) {
  const slug = document.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "");
  return `pragma-factura-${slug}.pdf`;
}
