import { PragmaLogo } from "@/components/brand/pragma-logo";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-pragma-soft-gray">
      <header className="border-b border-border bg-white px-6 py-4">
        <PragmaLogo variant="full" tone="light" fullClassName="h-8 w-auto" />
      </header>
      <main className="px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
