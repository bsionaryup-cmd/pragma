import "server-only";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { getOpenCashSession } from "@/domains/retail/auth/require-open-cash";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";

export async function CashGateBanner({
  moduleLabel,
}: {
  moduleLabel: string;
}) {
  const { store } = await requireRetailContext();
  const session = await getOpenCashSession(store.id);
  if (session) return null;

  return (
    <div className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 size-6 shrink-0 text-amber-700" />
          <div>
            <p className="text-lg font-semibold text-amber-950">
              Abre caja para usar {moduleLabel}
            </p>
            <p className="mt-1 text-base text-amber-900/80">
              Puedes consultar inventario, productos y reportes. Ventas, compras,
              pedidos y movimientos requieren caja abierta para operar.
            </p>
          </div>
        </div>
        <Link href="/intiendas/configuracion">
          <TiendasOnPrimaryButton type="button" className="text-base">
            Abrir caja
          </TiendasOnPrimaryButton>
        </Link>
      </div>
    </div>
  );
}

export async function hasOpenCash(): Promise<boolean> {
  const { store } = await requireRetailContext();
  const session = await getOpenCashSession(store.id);
  return Boolean(session);
}
