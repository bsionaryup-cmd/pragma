import { cn } from "@/lib/utils";
import { BackLink } from "@/components/ui/back-link";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {backHref ? (
          <BackLink href={backHref} label={backLabel} className="mb-3" />
        ) : null}
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
