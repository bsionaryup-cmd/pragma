"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { THEME_STORAGE_KEY } from "@/lib/constants";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

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
  systemTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

/** :root = light premium; .dark class for full dark app shell */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (resolved === "dark") {
    root.classList.add("dark");
  }
  root.style.colorScheme = resolved;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // ignore
  }
  return "dark";
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

function createInitialThemeState(
  defaultTheme: Theme,
  defaultResolved: ResolvedTheme,
): ThemeState {
  if (typeof window === "undefined") {
    return { theme: defaultTheme, resolved: defaultResolved };
  }

  const theme = readStoredTheme();
  const resolved = resolveTheme(theme);
  applyTheme(resolved);
  persistTheme(theme, resolved);
  return { theme, resolved };
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  defaultResolved = "light",
}: ThemeProviderProps) {
  const [state, setState] = useState<ThemeState>(() =>
    createInitialThemeState(defaultTheme, defaultResolved),
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      setState((prev) => {
        if (prev.theme !== "system") return prev;
        const resolved = getSystemTheme();
        applyTheme(resolved);
        persistTheme("system", resolved);
        return { theme: "system", resolved };
      });
    };

    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    const resolved = resolveTheme(next);
    setState({ theme: next, resolved });
    applyTheme(resolved);
    persistTheme(next, resolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: state.theme,
      resolvedTheme: state.resolved,
      setTheme,
      themes: ["light", "dark", "system"],
      systemTheme: getSystemTheme(),
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
