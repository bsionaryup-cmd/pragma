export function splitStayPortalLines(
  value: string | null | undefined,
  max: number,
): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/\r?\n+/)
    .map((line) =>
      line
        .replace(/^[\s]*(?:[\d️⃣]+[.\)\-]?\s*|[•\-–*]\s*)/u, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, max);
}

export const DEFAULT_DOOR_STEPS = [
  {
    title: "Activa la cerradura",
    body: "Toca el teclado para activarla.",
  },
  {
    title: "Escribe tu código",
    body: "Ingresa el código de acceso y confirma.",
  },
  {
    title: "Si falla tres veces",
    body: "Espera 3 a 5 minutos e inténtalo de nuevo.",
  },
] as const;

export const DEFAULT_HOUSE_RULES = [
  "Solo está permitido el ingreso de los huéspedes registrados.",
  "No se permiten fiestas ni eventos.",
  "Evita ruidos fuertes, especialmente de noche.",
  "Apaga las luces y el aire acondicionado cuando salgas.",
  "Cuida el apartamento y tus pertenencias.",
] as const;
