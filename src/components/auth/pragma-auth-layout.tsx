import { ClerkAuthFooterCleanup } from "@/components/auth/clerk-auth-footer-cleanup";
import { PragmaAuthBrand } from "@/components/brand/pragma-auth-brand";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { BackLink } from "@/components/ui/back-link";
import { BRAND } from "@/lib/brand";

type PragmaAuthLayoutProps = {
  children: React.ReactNode;
  hint?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function PragmaAuthLayout({
  children,
  hint,
  backHref,
  backLabel,
}: PragmaAuthLayoutProps) {
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

      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-4">
        <div className="flex w-full max-w-[min(100%,26rem)] shrink-0 flex-col items-center gap-2 sm:max-w-md sm:gap-3">
          {backHref ? (
            <div className="w-full">
              <BackLink href={backHref} label={backLabel} />
            </div>
          ) : null}
          <div className="flex w-full justify-center lg:hidden">
            <PragmaLogo
              variant="full"
              tone="light"
              priority
              fullClassName="h-14 w-auto max-w-[min(100%,18rem)] sm:h-16"
            />
          </div>

          {hint ? (
            <div className="w-full shrink-0 text-center text-xs sm:text-sm [&_p]:mx-auto [&_p]:max-w-md [&_p]:leading-snug">
              {hint}
            </div>
          ) : null}

          <div className="w-full shrink-0 rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5">
            {children}
          </div>

          <p className="w-full shrink-0 text-center text-[10px] text-muted-foreground sm:text-xs lg:hidden">
            {BRAND.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
