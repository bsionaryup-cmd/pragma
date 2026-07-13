import { PackageOpen } from "lucide-react";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default function RetailReturnsPage() {
  return (
    <TiendasOnScreen title="Devoluciones" backHref="/intiendas/inventario">
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="relative flex size-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#c5d5e8]/70" />
          <div className="absolute inset-3 rounded-full border border-[#d5e3f0]/80" />
          <PackageOpen className="relative size-12 text-[#5a6f85]" strokeWidth={1.35} />
        </div>
        <p className="text-2xl font-semibold text-[#3d4a5c]">Devoluciones</p>
        <p className="max-w-md text-lg text-[#718096]">
          Registra devoluciones de productos al inventario. Módulo listo para operación diaria.
        </p>
      </div>
    </TiendasOnScreen>
  );
}
