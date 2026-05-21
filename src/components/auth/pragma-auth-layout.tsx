import { PragmaLogo } from "@/components/brand/pragma-logo";
import { BRAND } from "@/lib/brand";

type PragmaAuthLayoutProps = {
  children: React.ReactNode;
  hint?: React.ReactNode;
};

export function PragmaAuthLayout({ children, hint }: PragmaAuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-pragma-gradient-subtle lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between border-r border-border/60 bg-card/50 p-10 lg:flex">
        <div className="space-y-6">
          <PragmaLogo variant="full" priority className="max-w-[220px]" />
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {BRAND.positioning}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {BRAND.productName} · {BRAND.tagline}
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <PragmaLogo variant="symbol" symbolClassName="h-12 w-12" className="mx-auto" />
          <p className="mt-3 font-accent text-lg font-bold tracking-[0.14em] text-foreground">
            PRAGMA
          </p>
        </div>
        {hint}
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 shadow-pragma-soft sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
