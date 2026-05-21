import type { LucideIcon } from "lucide-react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  branded?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  branded = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      {branded ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pragma-soft-cyan/60 ring-1 ring-pragma-cyan/15 dark:bg-primary/10">
          <PragmaLogo variant="mark" symbolClassName="h-9 w-9 opacity-80" />
        </div>
      ) : Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      ) : null}
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
