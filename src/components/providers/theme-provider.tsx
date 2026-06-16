"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { THEME_STORAGE_KEY } from "@/lib/constants";
import type { ResolvedTheme, Theme } from "@/lib/theme";

export type { ResolvedTheme, Theme } from "@/lib/theme";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultResolved?: ResolvedTheme;
};

type ThemeState = {
  theme: Theme;
  resolved: ResolvedTheme;
};

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: Theme, systemFallback: ResolvedTheme): ResolvedTheme {
  if (theme === "system") {
    return typeof window === "undefined" ? systemFallback : getSystemTheme();
  }
  return theme;
}

function readThemeFromDocumentCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_STORAGE_KEY}=([^;]*)`),
  );
  const value = match?.[1];
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return null;
}

/** Client-only: localStorage → cookie → SSR fallback (never called during SSR render). */
function readStoredTheme(fallback: Theme): Theme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // ignore
  }
  return readThemeFromDocumentCookie() ?? fallback;
}

function persistTheme(theme: Theme, resolved: ResolvedTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.cookie = `${THEME_STORAGE_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
    document.cookie = `pragma-theme-resolved=${resolved};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    // ignore
  }
}

/** Apply resolved theme at document root so shell chrome inherits tokens. */
function applyThemeToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.remove("dark");
  if (resolved === "dark") {
    root.classList.add("dark");
  }
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  defaultResolved = "light",
}: ThemeProviderProps) {
  const [state, setState] = useState<ThemeState>(() => ({
    theme: defaultTheme,
    resolved: defaultResolved,
  }));

  // After hydration: reconcile localStorage/cookie drift (SSR uses cookie snapshot only).
  useEffect(() => {
    const stored = readStoredTheme(defaultTheme);
    const resolved = resolveTheme(stored, defaultResolved);

    queueMicrotask(() => {
      setState((prev) => {
        if (prev.theme === stored && prev.resolved === resolved) return prev;
        persistTheme(stored, resolved);
        return { theme: stored, resolved };
      });
    });
  }, [defaultTheme, defaultResolved]);

  useLayoutEffect(() => {
    applyThemeToDocument(state.resolved);
  }, [state.resolved]);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      setState((prev) => {
        if (prev.theme !== "system") return prev;
        const resolved = getSystemTheme();
        persistTheme("system", resolved);
        return { theme: "system", resolved };
      });
    };

    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    const resolved = resolveTheme(next, getSystemTheme());
    setState({ theme: next, resolved });
    persistTheme(next, resolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: state.theme,
      resolvedTheme: state.resolved,
      setTheme,
      themes: ["light", "dark", "system"],
    }),
    [state.theme, state.resolved, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }
  return ctx;
}
