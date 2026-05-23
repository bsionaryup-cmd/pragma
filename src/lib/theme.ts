export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function parseThemePreference(value: string | undefined): Theme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "light";
}

export function resolveThemeFromCookies(
  themeCookie: string | undefined,
  resolvedCookie: string | undefined,
): { theme: Theme; resolved: ResolvedTheme } {
  const theme = parseThemePreference(themeCookie);

  if (theme === "light" || theme === "dark") {
    return { theme, resolved: theme };
  }

  return {
    theme,
    resolved: resolvedCookie === "dark" ? "dark" : "light",
  };
}
