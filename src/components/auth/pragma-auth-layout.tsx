import { PragmaLogo } from "@/components/brand/pragma-logo";
import { BRAND } from "@/lib/brand";

type PragmaAuthLayoutProps = {
  children: React.ReactNode;
  hint?: React.ReactNode;
};

export function PragmaAuthLayout({ children, hint }: PragmaAuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-pragma-gradient-subtle lg:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-pragma-navy p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pragma-electric/20 blur-3xl"
        />
        <div className="relative space-y-6">
          <PragmaLogo
            variant="full"
            tone="dark"
            priority
            fullClassName="h-9 w-auto max-w-[12rem]"
          />
          <p className="max-w-sm text-sm leading-7 text-white/75">
            {BRAND.positioning}
          </p>
        </div>
        <p className="relative text-xs text-white/50">
          {BRAND.productName} · {BRAND.tagline}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <PragmaLogo
            variant="mark"
            symbolClassName="h-11 w-11"
            className="mx-auto"
          />
          <p className="mt-3 font-accent text-base font-bold tracking-[0.16em] text-foreground">
            PRAGMA
          </p>
        </div>
        {hint}
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 shadow-pragma-soft sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
          {BRAND.tagline}
        </p>
      </div>
    </div>
  );
}
