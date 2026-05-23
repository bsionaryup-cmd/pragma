import { cn } from "@/lib/utils";

export function DetailRow({
  label,
  value,
  children,
  className,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children ?? (
        <span className="text-sm text-foreground">{value?.trim() || "—"}</span>
      )}
    </div>
  );
}

export function DetailSection({
  title,
  children,
  headerAside,
  className,
}: {
  title: string;
  children: React.ReactNode;
  headerAside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-3 border-b border-border pb-4 last:border-0",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {headerAside}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function DetailDrawerHero({
  badge,
  title,
  subtitle,
  action,
}: {
  badge: React.ReactNode;
  title: string;
  subtitle?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {badge}
          <h3 className="mt-2 text-lg font-semibold leading-tight">{title}</h3>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function DetailListItem({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <li className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {aside}
      </div>
    </li>
  );
}

export function DetailEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function DetailStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
