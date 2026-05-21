import { BRAND } from "@/lib/brand";
import { BRAND_ASSETS } from "@/lib/brand-assets";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://pragma-pms.vercel.app";

/** Cabecera HTML reutilizable para correos del sistema. */
export function pragmaEmailHeaderHtml(): string {
  const logoUrl = `${siteUrl}${BRAND_ASSETS.logoFullLight}`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      <tr>
        <td>
          <img src="${logoUrl}" alt="${BRAND.name}" width="160" height="48" style="display:block;max-width:160px;height:auto" />
        </td>
      </tr>
    </table>
  `.trim();
}

export function pragmaEmailFooterHtml(): string {
  return `
    <p style="margin:32px 0 0;font-size:12px;color:#6b7280;line-height:1.5">
      ${BRAND.productName} · ${BRAND.tagline}<br />
      <a href="${siteUrl}" style="color:#0066ff;text-decoration:none">${siteUrl.replace(/^https?:\/\//, "")}</a>
    </p>
  `.trim();
}
