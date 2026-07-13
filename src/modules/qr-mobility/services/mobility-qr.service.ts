import "server-only";

import QRCode from "qrcode";
import {
  buildMobilityPublicUrl,
  generateMobilityQrToken,
  slugifyAllyCode,
} from "@/lib/qr-mobility/mobility-qr-url";

export {
  buildMobilityPublicUrl,
  generateMobilityQrToken,
  slugifyAllyCode,
};

export async function generateMobilityQrImageDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}
