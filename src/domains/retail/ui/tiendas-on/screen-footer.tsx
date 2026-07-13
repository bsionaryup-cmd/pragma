import { INTIENDAS_VERSION } from "./modules";
import { formatIntiendasDateTime } from "./format";

export function TiendasOnScreenFooter({
  storeCode,
  pendingSync = 0,
}: {
  storeCode?: string;
  pendingSync?: number;
}) {
  return (
    <footer className="shrink-0 border-t border-[#d9dee5] bg-[#f8fafc] px-4 py-2 text-[11px] text-[#718096]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{storeCode ?? "INTIENDAS"}</span>
        <span>Versión {INTIENDAS_VERSION}</span>
        <span>Pendientes por sincronizar: {pendingSync}</span>
        <span>Información del {formatIntiendasDateTime(new Date())}</span>
      </div>
    </footer>
  );
}
