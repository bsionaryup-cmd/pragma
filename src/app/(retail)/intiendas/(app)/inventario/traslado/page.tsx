import { ArrowLeftRight } from "lucide-react";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default function RetailTransferPage() {
  return (
    <TiendasOnScreen title="Traslado de Productos" backHref="/intiendas/inventario">
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="relative flex size-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#c5d5e8]/70" />
          <div className="absolute inset-3 rounded-full border border-[#d5e3f0]/80" />
          <ArrowLeftRight className="relative size-12 text-[#5a6f85]" strokeWidth={1.35} />
        </div>
        <p className="text-2xl font-semibold text-[#3d4a5c]">Traslado de Productos</p>
        <p className="max-w-md text-lg text-[#718096]">
          Mueve existencias entre ubicaciones o puntos de venta. Interfaz preparada para operación.
        </p>
      </div>
    </TiendasOnScreen>
  );
}
