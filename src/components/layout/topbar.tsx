"use client";

import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { useMounted } from "@/hooks/use-mounted";

type TopbarProps = {
  title?: string;
  description?: string;
};

export function Topbar({ title = "Dashboard", description }: TopbarProps) {
  const mounted = useMounted();

  return (
    <header className="flex h-[3.75rem] shrink-0 items-center gap-4 border-b border-[#E9ECEF] bg-white px-6 shadow-pragma-soft dark:border-border dark:bg-card dark:shadow-none">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-[#111111] dark:text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="truncate text-sm text-[#6B7280] dark:text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Separator orientation="vertical" className="h-6" />
        {mounted ? (
          <UserButton
            appearance={{
              elements: { avatarBox: "h-9 w-9 ring-2 ring-[#E9ECEF]" },
            }}
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-muted" aria-hidden="true" />
        )}
      </div>
    </header>
  );
}
