import { ClerkAuthFooterCleanup } from "@/components/auth/clerk-auth-footer-cleanup";
import { PragmaAuthBrand } from "@/components/brand/pragma-auth-brand";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { BRAND } from "@/lib/brand";

type PragmaAuthLayoutProps = {
  children: React.ReactNode;
  hint?: React.ReactNode;
};

export function PragmaAuthLayout({ children, hint }: PragmaAuthLayoutProps) {
  return (
    <div className="pragma-auth-shell flex h-dvh flex-col overflow-hidden bg-pragma-gradient-subtle lg:flex-row">
      <ClerkAuthFooterCleanup />

      <div className="relative hidden min-h-0 flex-1 overflow-hidden bg-pragma-navy lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pragma-electric/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-pragma-cyan/10 blur-3xl"
        />

        <div className="relative flex flex-1 items-center justify-center px-10 py-16">
          <div className="flex max-w-md flex-col items-center gap-8 text-center">
            <PragmaAuthBrand />
            <p className="text-sm leading-7 text-white/75">{BRAND.positioning}</p>
          </div>
        </div>

        <p className="relative shrink-0 px-10 pb-10 text-center text-xs text-white/50">
          {BRAND.productName} · {BRAND.tagline}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4 py-2 sm:gap-5">
          <div className="flex w-full justify-center lg:hidden">
            <PragmaLogo
              variant="full"
              tone="light"
              priority
              fullClassName="h-20 w-auto max-w-[min(100%,20rem)] sm:h-24"
            />
          </div>

          {hint ? (
            <div className="w-full text-center [&_p]:mx-auto [&_p]:max-w-md">{hint}</div>
          ) : null}

          <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-pragma-soft sm:p-6">
            {children}
          </div>

          <p className="w-full text-center text-xs text-muted-foreground lg:hidden">
            {BRAND.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
