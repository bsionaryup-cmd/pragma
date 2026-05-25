import {
  getSirePortalBaseUrl,
  getSirePortalLoginPath,
} from "@/lib/integrations/sire-config";
import { mergeSetCookieHeaders, sireFetch, SireHttpError } from "./sire-http";

export type SirePortalCredentials = {
  documentType: string;
  documentNumber: string;
  password: string;
  /** Valor de `formLogin:listaEmpresa` en el portal (ID de persona jurídica). */
  companyId?: string | null;
};

export type SirePortalTestResult =
  | { ok: true; sessionCookie: string | null; message: string }
  | { ok: false; message: string };

/** Extrae mensajes de error del panel JSF tras un intento de login. */
export function parseSirePortalLoginError(html: string): string | null {
  const label = html.match(
    /<span[^>]*class="rich-messages-label"[^>]*>([^<]+)<\/span>/i,
  );
  if (label?.[1]) {
    return decodeHtmlEntities(label[1].trim());
  }
  if (/informaci[oó]n de usuario o contrase/i.test(html)) {
    return "Información de usuario o contraseña no corresponden. Por favor verifique.";
  }
  return null;
}

export function isSirePortalLoginSuccess(
  response: Response,
  html: string,
): boolean {
  const location = response.headers.get("location") ?? "";
  if (response.status >= 300 && response.status < 400) {
    if (location && !location.includes("login.jsf")) return true;
  }

  const portalError = parseSirePortalLoginError(html);
  if (portalError) return false;

  if (!html.includes('id="formLogin"') && !html.includes("formLogin:password")) {
    return true;
  }

  if (html.includes("queuedMessages") && !html.includes("imagenes/error.png")) {
    return true;
  }

  return false;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"');
}

function extractViewState(html: string): string {
  const match = html.match(
    /name="javax\.faces\.ViewState"[^>]*value="([^"]*)"/i,
  );
  return match?.[1]?.trim() || "j_id1";
}

function resolvePostUrl(baseUrl: string, action: string): string {
  const normalized = action.replace(/;jsessionid=[^/]+/i, "");
  if (normalized.startsWith("http")) return normalized;
  if (normalized.startsWith("/")) return `${baseUrl}${normalized}`;
  return `${baseUrl}/${normalized}`;
}

function extractFormAction(html: string, loginPath: string): string {
  const match = html.match(/<form[^>]*id="formLogin"[^>]*action="([^"]*)"/i);
  return match?.[1]?.trim() || loginPath;
}

export async function testSirePortalConnection(
  credentials: SirePortalCredentials,
): Promise<SirePortalTestResult> {
  const baseUrl = getSirePortalBaseUrl();
  const loginPath = getSirePortalLoginPath();
  const loginUrl = `${baseUrl}${loginPath}`;

  const documentType = credentials.documentType.trim();
  const documentNumber = credentials.documentNumber.trim();
  const password = credentials.password;

  if (!documentType || !documentNumber || !password) {
    return {
      ok: false,
      message: "Tipo de documento, número de documento y contraseña son obligatorios",
    };
  }

  let cookieHeader: string | undefined;

  const getResponse = await sireFetch(loginUrl, {
    method: "GET",
    redirect: "manual",
  });

  if (!getResponse.ok && getResponse.status !== 302) {
    throw new SireHttpError(
      `SIRE portal no disponible (HTTP ${getResponse.status})`,
      "HTTP",
      { status: getResponse.status },
    );
  }

  const loginHtml = await getResponse.text();
  cookieHeader = mergeSetCookieHeaders(
    cookieHeader,
    getResponse.headers.getSetCookie?.() ?? getResponse.headers.get("set-cookie"),
  );

  const viewState = extractViewState(loginHtml);
  const formAction = extractFormAction(loginHtml, loginPath);
  const postUrl = resolvePostUrl(baseUrl, formAction);

  const companyId =
    credentials.companyId?.trim() && credentials.companyId.trim() !== ""
      ? credentials.companyId.trim()
      : "-1";

  const body = new URLSearchParams({
    formLogin: "formLogin",
    "formLogin:tipoDocumento": documentType,
    "formLogin:numeroDocumento": documentNumber,
    "formLogin:password": password,
    "formLogin:listaEmpresa": companyId,
    "formLogin:button1": "Ingresar",
    "javax.faces.ViewState": viewState,
  });

  const postResponse = await sireFetch(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: body.toString(),
    redirect: "manual",
  });

  cookieHeader = mergeSetCookieHeaders(
    cookieHeader,
    postResponse.headers.getSetCookie?.() ??
      postResponse.headers.get("set-cookie"),
  );

  const postHtml = await postResponse.text();
  const portalError = parseSirePortalLoginError(postHtml);

  if (portalError) {
    const hint =
      companyId === "-1"
        ? " Si tu cuenta tiene varias empresas, guarda en Callback URL el ID de `listaEmpresa` del portal SIRE."
        : "";
    return { ok: false, message: `${portalError}${hint}` };
  }

  if (!isSirePortalLoginSuccess(postResponse, postHtml)) {
    if (postResponse.status >= 500) {
      throw new SireHttpError(
        `SIRE portal respondió con error ${postResponse.status}`,
        "HTTP",
        { status: postResponse.status },
      );
    }
    return {
      ok: false,
      message:
        "No se pudo validar el inicio de sesión en el portal SIRE. Verifica tipo de documento, número, contraseña y empresa (Callback URL).",
    };
  }

  return {
    ok: true,
    sessionCookie: cookieHeader ?? null,
    message: "Conexión validada con el portal SIRE (Migración Colombia)",
  };
}
