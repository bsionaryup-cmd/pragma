const MAX_ATTACHMENT_BYTES = 512_000;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export async function resolveFinanceAttachmentUrl(
  formData: FormData,
): Promise<string | null> {
  const urlField = String(formData.get("attachmentUrl") ?? "").trim();
  if (urlField) return urlField;

  const file = formData.get("attachmentFile");
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("El archivo supera 500 KB. Usa un enlace o comprime la imagen.");
  }

  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG, WEBP o PDF.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
