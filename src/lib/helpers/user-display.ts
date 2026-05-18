export function getUserInitials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  const first = firstName?.trim().charAt(0) ?? "";
  const last = lastName?.trim().charAt(0) ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return email.charAt(0).toUpperCase();
}

export function getUserDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" ").toUpperCase();
  return email.split("@")[0]?.toUpperCase() ?? email;
}
