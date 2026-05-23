import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackLinkProps = {
  href: string;
  label?: string;
  className?: string;
};

export function BackLink({
  href,
  label = "Volver",
  className,
}: BackLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn("-ml-2 w-fit gap-1.5 px-2 text-muted-foreground hover:text-foreground", className)}
    >
      <Link href={href}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
