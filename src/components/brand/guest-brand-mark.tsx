import { PragmaLogo } from "@/components/brand/pragma-logo";

export function GuestBrandMark() {
  return (
    <div className="flex flex-col items-center gap-2">
      <PragmaLogo variant="mark" symbolClassName="h-10 w-10" />
      <span className="font-accent text-xs font-bold uppercase tracking-[0.2em] text-primary">
        PRAGMA
      </span>
    </div>
  );
}
