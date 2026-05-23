const ACCESS_CODE_SUFFIX = "#";

/** Quita el sufijo # (uno o más) para API TTLock y almacenamiento numérico. */
export function stripAccessCodeSuffix(code: string): string {
  return code.trim().replace(/#+$/u, "");
}

/** Formato visible/copia: siempre termina en #. */
export function formatAccessCode(
  code: string | null | undefined,
): string | null {
  const core = stripAccessCodeSuffix(code ?? "");
  if (!core) return null;
  return `${core}${ACCESS_CODE_SUFFIX}`;
}

/** Código listo para enviar a TTLock (solo dígitos/contenido sin #). */
export function formatAccessCodeForLockApi(code: string): string {
  return stripAccessCodeSuffix(code);
}
