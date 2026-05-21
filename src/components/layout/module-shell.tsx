import { cn } from "@/lib/utils";

/** Full viewport-height modules with internal panes (reservations, calendar, inbox). */
export function ModuleShellFill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Scrollable content pages (dashboard, finance, settings). */
export function ModuleShellFlow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col", className)}>{children}</div>
  );
}
