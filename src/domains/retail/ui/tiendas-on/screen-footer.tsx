import { INTIENDAS_VERSION } from "./modules";
import { formatIntiendasDate } from "./format";

export function TiendasOnScreenFooter({ storeCode }: { storeCode?: string }) {
  // Date-only (no clock) avoids SSR/CSR hydration mismatch from `new Date()` seconds.
  const stamp = formatIntiendasDate(new Date());

  return (
    <footer className="shrink-0 border-t border-[#d9dee5] bg-[#f8fafc] px-4 py-2 text-[11px] text-[#718096]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{storeCode ?? "INTIENDAS"}</span>
        <span>Versión {INTIENDAS_VERSION}</span>
        <span suppressHydrationWarning>Información del {stamp}</span>
      </div>
    </footer>
  );
}
