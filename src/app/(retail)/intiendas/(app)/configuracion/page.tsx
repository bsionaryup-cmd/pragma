import Link from "next/link";
import { BookOpen, Settings, Shield, Wallet } from "lucide-react";
import { closeCashAction, openCashAction, updateStoreAction } from "@/domains/retail/actions/retail.actions";
import { getSettingsData } from "@/domains/retail/services/retail-ui.service";
import { TiendasOnSummaryCard, TiendasOnSummaryRow } from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailSettingsPage() {
  const { store, registers } = await getSettingsData();
  const open = registers.flatMap((register) =>
    register.sessions.map((session) => ({ register, session })),
  )[0];

  return (
    <TiendasOnScreen title="Configuración">
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <TiendasOnSummaryCard
          title="Centro de Ayuda"
          accent="pragma"
          icon={<BookOpen className="size-5 text-pragma-electric" />}
          action={
            <Link href="/intiendas/configuracion/ayuda" className="text-xs text-pragma-electric">
              Abrir
            </Link>
          }
        >
          <p className="text-sm text-[#4a5568]">
            Manual oficial de INTIENDAS: busca por módulo, lee artículos y descarga el PDF.
          </p>
          <Link href="/intiendas/configuracion/ayuda" className="mt-3 inline-block">
            <TiendasOnPrimaryButton type="button">Ir al Centro de Ayuda</TiendasOnPrimaryButton>
          </Link>
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Seguridad"
          accent="amber"
          icon={<Shield className="size-5 text-[#d69e2e]" />}
          action={
            <Link href="/intiendas/configuracion/seguridad" className="text-xs text-pragma-electric">
              Abrir
            </Link>
          }
        >
          <p className="text-sm text-[#4a5568]">
            Cambia tu contraseña sin depender del administrador.
          </p>
          <Link href="/intiendas/configuracion/seguridad" className="mt-3 inline-block">
            <TiendasOnPrimaryButton type="button">Cambiar contraseña</TiendasOnPrimaryButton>
          </Link>
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Datos de la tienda"
          accent="pragma"
          icon={<Settings className="size-5 text-pragma-electric" />}
        >
          <form action={updateStoreAction} className="space-y-3">
            <label className="block text-sm text-[#718096]">
              Nombre comercial
              <input
                name="name"
                defaultValue={store.name}
                required
                className="mt-1 h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm text-[#2d3748]"
              />
            </label>
            <label className="block text-sm text-[#718096]">
              Razón social (facturas)
              <input
                name="legalName"
                defaultValue={store.legalName ?? ""}
                placeholder={store.name}
                className="mt-1 h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm text-[#2d3748]"
              />
            </label>
            <label className="block text-sm text-[#718096]">
              NIT
              <input
                name="taxId"
                defaultValue={store.taxId ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm text-[#2d3748]"
              />
            </label>
            <label className="block text-sm text-[#718096]">
              Dirección
              <input
                name="address"
                defaultValue={store.address ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm text-[#2d3748]"
              />
            </label>
            <label className="block text-sm text-[#718096]">
              Teléfono
              <input
                name="phone"
                defaultValue={store.phone ?? ""}
                className="mt-1 h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm text-[#2d3748]"
              />
            </label>
            <label className="block text-sm text-[#718096]">
              Prefijo de factura
              <input
                name="invoicePrefix"
                defaultValue={store.invoicePrefix ?? "FV"}
                maxLength={12}
                className="mt-1 h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm text-[#2d3748]"
              />
            </label>
            <TiendasOnSummaryRow label="Moneda operativa" value={store.currency} />
            <TiendasOnPrimaryButton type="submit">Guardar cambios</TiendasOnPrimaryButton>
          </form>
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Caja registradora"
          accent="amber"
          icon={<Wallet className="size-5 text-[#d69e2e]" />}
        >
          {open ? (
            <div className="space-y-4">
              <TiendasOnSummaryRow label="Caja" value={open.register.name} />
              <TiendasOnSummaryRow
                label="Base de apertura"
                value={formatIntiendasMoney(open.session.openingAmount)}
              />
              <TiendasOnSummaryRow label="Estado" value="ABIERTA" tone="positive" />
              <form action={closeCashAction} className="flex flex-wrap gap-2 pt-2">
                <input type="hidden" name="sessionId" value={open.session.id} />
                <input
                  name="closingAmount"
                  type="number"
                  min="0"
                  placeholder="Efectivo al cierre"
                  required
                  className="h-10 min-w-[160px] flex-1 rounded-md border border-[#c5ced8] px-3 text-sm"
                />
                <TiendasOnPrimaryButton type="submit">Cerrar caja</TiendasOnPrimaryButton>
              </form>
            </div>
          ) : (
            <form action={openCashAction} className="space-y-3">
              {registers.length ? (
                <select
                  name="registerId"
                  className="h-10 w-full rounded-md border border-[#c5ced8] bg-white px-3 text-sm"
                >
                  {registers.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-[#718096]">Se creará una caja principal automáticamente.</p>
              )}
              <input
                name="openingAmount"
                type="number"
                min="0"
                placeholder="Base inicial"
                required
                className="h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm"
              />
              <TiendasOnPrimaryButton type="submit" className="w-full">
                Abrir caja
              </TiendasOnPrimaryButton>
            </form>
          )}
        </TiendasOnSummaryCard>
      </div>
    </TiendasOnScreen>
  );
}
