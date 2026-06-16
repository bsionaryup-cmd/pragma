"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/providers/theme-provider";
import type { Theme } from "@/lib/theme";
import { syncThemePreferenceAction } from "@/features/settings/actions/settings.actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

type ThemeToggleProps = {
  size?: "default" | "sm";
  align?: "start" | "end";
  className?: string;
};

function ThemeToggleMenu({ size = "default", align = "end", className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const iconSize = size === "sm" ? "h-4 w-4" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-9 w-9" : "h-9 w-9";

  function selectTheme(next: Theme) {
    setTheme(next);
    void syncThemePreferenceAction(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", buttonSize, className)}
          aria-label="Cambiar tema"
        >
          <Sun
            className={cn(
              iconSize,
              "rotate-0 scale-100 transition-transform duration-200 dark:scale-0 dark:-rotate-90",
            )}
          />
          <Moon
            className={cn(
              iconSize,
              "absolute rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100",
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[10.5rem]">
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => selectTheme(value)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </span>
            {theme === value ? (
              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
        <p className="border-t border-border px-2 py-1.5 text-[10px] text-muted-foreground">
          Activo: {resolvedTheme === "dark" ? "Oscuro" : "Claro"}
          {theme === "system" ? " (sistema)" : ""}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle(props: ThemeToggleProps) {
  const mounted = useMounted();
  const { resolvedTheme } = useTheme();
  const iconSize = props.size === "sm" ? "h-4 w-4" : "h-4 w-4";
  const buttonSize = props.size === "sm" ? "h-9 w-9" : "h-9 w-9";

  if (!mounted) {
    const PlaceholderIcon = resolvedTheme === "dark" ? Moon : Sun;
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative", buttonSize, props.className)}
        disabled
        aria-label="Cambiar tema"
      >
        <PlaceholderIcon className={iconSize} aria-hidden />
      </Button>
    );
  }

  return <ThemeToggleMenu {...props} />;
}
