import { cn } from "@/lib/utils";

/** Clases compartidas para bandejas split-pane (Novedades, Reservas, etc.). */
export const moduleShellClasses = {
  canvas: "bg-module-canvas",
  paneList: "bg-module-pane",
  paneDetail: "bg-module-pane-alt",
  paneHeader: "border-b border-border bg-module-pane",
} as const;

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
        moduleShellClasses.canvas,
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
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        moduleShellClasses.canvas,
        className,
      )}
    >
      {children}
    </div>
  );
}
