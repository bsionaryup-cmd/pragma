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
        <div className="relative flex flex-col items-center gap-8 text-center">
          <PragmaLogo
            variant="full"
            tone="dark"
            priority
            fullClassName="h-28 w-full max-w-[min(100%,36rem)] md:h-32"
          />
          <p className="max-w-md text-sm leading-7 text-white/75">
            {BRAND.positioning}
          </p>
        </div>
        <p className="relative text-center text-xs text-white/50">
          {BRAND.productName} · {BRAND.tagline}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-10 flex w-full max-w-md justify-center lg:hidden">
          <PragmaLogo
            variant="full"
            fullClassName="h-24 w-full max-w-[min(100%,26rem)] sm:h-28"
          />
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
