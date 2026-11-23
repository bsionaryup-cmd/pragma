import "server-only";

export type WebMediaObjectStorageStatus =
  | { ready: true; bucket: string; region: string; publicBaseUrl: string }
  | { ready: false; reason: string };

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
]);

export function isWebMediaImagePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXT.has(lower.slice(dot));
}

export function resolveWebMediaObjectStorage(): WebMediaObjectStorageStatus {
  const bucket = process.env.WEB_BUILDER_S3_BUCKET?.trim();
  const region =
    process.env.WEB_BUILDER_S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl =
    process.env.WEB_BUILDER_S3_PUBLIC_BASE_URL?.trim() ||
    (bucket && region ? `https://${bucket}.s3.${region}.amazonaws.com` : "");

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return {
      ready: false,
      reason:
        "PENDING EXTERNAL: configura WEB_BUILDER_S3_BUCKET, WEB_BUILDER_S3_REGION (o AWS_REGION), AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY para subir archivos del ZIP.",
    };
  }

  if (!publicBaseUrl) {
    return {
      ready: false,
      reason:
        "PENDING EXTERNAL: define WEB_BUILDER_S3_PUBLIC_BASE_URL o bucket/región válidos.",
    };
  }

  return {
    ready: true,
    bucket,
    region,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
  };
}

export async function uploadWebMediaBufferToObjectStorage(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  const storage = resolveWebMediaObjectStorage();
  if (!storage.ready) {
    return { ok: false, message: storage.reason };
  }

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: storage.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      },
    });

    const sanitizedKey = input.key.replace(/^\/+/, "");
    await client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: sanitizedKey,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    const publicUrl = `${storage.publicBaseUrl}/${sanitizedKey}`;
    return { ok: true, publicUrl };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al subir a object storage";
    if (/Cannot find module|MODULE_NOT_FOUND/i.test(message)) {
      return {
        ok: false,
        message:
          "PENDING EXTERNAL: instala @aws-sdk/client-s3 y configura credenciales S3.",
      };
    }
    return { ok: false, message };
  }
}

export function guessImageContentType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}