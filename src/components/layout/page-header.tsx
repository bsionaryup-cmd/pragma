import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {backHref ? (
          <BackLink href={backHref} label={backLabel} className="mb-3" />
        ) : null}
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Button asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
