import "server-only";

import PDFDocument from "pdfkit";
import { HELP_ARTICLES, HELP_MANUAL_VERSION } from "@/domains/retail/help/catalog";
import { INTIENDAS_VERSION } from "@/domains/retail/ui/tiendas-on/modules";

export async function buildIntiendasHelpManualPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: "LETTER",
      info: {
        Title: `Manual INTIENDAS v${HELP_MANUAL_VERSION}`,
        Author: "PRAGMA INTIENDAS",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const stamp = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    // Cover
    doc.fontSize(22).fillColor("#0B5FFF").text("PRAGMA INTIENDAS", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor("#1a202c").text("Manual de usuario", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#4a5568").text(`Versión del sistema: ${INTIENDAS_VERSION}`, {
      align: "center",
    });
    doc.text(`Versión del manual: ${HELP_MANUAL_VERSION}`, { align: "center" });
    doc.text(`Generado: ${stamp} (America/Bogota)`, { align: "center" });
    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor("#718096")
      .text(
        "Este PDF se genera automáticamente desde el Centro de Ayuda. No editar a mano.",
        { align: "center" },
      );

    // TOC
    doc.addPage();
    doc.fontSize(16).fillColor("#1a202c").text("Índice");
    doc.moveDown();
    HELP_ARTICLES.forEach((article, i) => {
      doc.fontSize(10).fillColor("#2d3748").text(`${i + 1}. ${article.title}`);
    });

    // Articles
    HELP_ARTICLES.forEach((article, i) => {
      doc.addPage();
      doc.fontSize(14).fillColor("#0B5FFF").text(`${i + 1}. ${article.title}`);
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor("#2d3748").text(`Objetivo: ${article.objective}`);
      doc.moveDown(0.3);
      doc.text(`¿Para qué sirve?: ${article.purpose}`);
      doc.moveDown(0.3);
      doc.text(`¿Cuándo usarla?: ${article.whenToUse}`);
      doc.moveDown(0.3);
      doc.text(article.overview);
      doc.moveDown(0.5);
      doc.fontSize(11).text("Pasos:");
      article.steps.forEach((step, n) => {
        doc.fontSize(10).text(`${n + 1}. ${step}`);
      });
      if (article.buttons.length) {
        doc.moveDown(0.4);
        doc.fontSize(11).text("Botones:");
        article.buttons.forEach((b) => {
          doc.fontSize(10).text(`• ${b.name}: ${b.meaning}`);
        });
      }
      if (article.fields.length) {
        doc.moveDown(0.4);
        doc.fontSize(11).text("Campos:");
        article.fields.forEach((f) => {
          doc.fontSize(10).text(`• ${f.name}: ${f.meaning}`);
        });
      }
      doc.moveDown(0.4);
      doc.fontSize(10).text(`Ejemplo: ${article.example}`);
      if (article.tips.length) {
        doc.moveDown(0.3);
        doc.text(`Consejos: ${article.tips.join(" · ")}`);
      }
      if (article.warnings.length) {
        doc.moveDown(0.3);
        doc.fillColor("#975a16").text(`Advertencias: ${article.warnings.join(" · ")}`);
        doc.fillColor("#2d3748");
      }
      doc
        .fontSize(8)
        .fillColor("#a0aec0")
        .text(
          `INTIENDAS v${INTIENDAS_VERSION} · Manual ${HELP_MANUAL_VERSION} · pág. ${i + 3}`,
          50,
          doc.page.height - 40,
          { align: "center" },
        );
    });

    doc.end();
  });
}
