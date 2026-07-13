import { createSupplierAction } from "@/domains/retail/actions/retail.actions";
import { getSuppliersData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { TiendasOnActionBar, TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailSuppliersPage() {
  const suppliers = await getSuppliersData();
  return (
    <TiendasOnScreen title="Proveedores" backHref="/intiendas/compras">
      <TiendasOnActionBar>
        <p className="text-sm text-[#718096]">{suppliers.length} proveedores registrados</p>
      </TiendasOnActionBar>

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_320px]">
        <TiendasOnTable>
          <TiendasOnTableHead>
            <TiendasOnTh>Proveedor</TiendasOnTh>
            <TiendasOnTh>Contacto</TiendasOnTh>
            <TiendasOnTh>Entrega</TiendasOnTh>
            <TiendasOnTh>Actividad</TiendasOnTh>
          </TiendasOnTableHead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <TiendasOnTd className="font-medium">{supplier.name}</TiendasOnTd>
                <TiendasOnTd>
                  <p>{supplier.contactName || "—"}</p>
                  <p className="text-xs text-[#94a3b8]">
                    {supplier.phone || supplier.email || "Sin contacto"}
                  </p>
                </TiendasOnTd>
                <TiendasOnTd>{supplier.leadTimeDays} días</TiendasOnTd>
                <TiendasOnTd>
                  {supplier._count.supplierProducts} productos · {supplier._count.purchaseOrders} órdenes
                </TiendasOnTd>
              </tr>
            ))}
          </tbody>
        </TiendasOnTable>

        <div className="rounded-md border border-[#d5dce6] bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#2d3748]">Nuevo proveedor</h3>
          <form action={createSupplierAction} className="space-y-3">
            <input
              name="name"
              placeholder="Nombre comercial"
              required
              className="h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm"
            />
            <input
              name="contactName"
              placeholder="Persona de contacto"
              className="h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm"
            />
            <input
              name="phone"
              type="tel"
              placeholder="Teléfono"
              className="h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm"
            />
            <input
              name="email"
              type="email"
              placeholder="Correo"
              className="h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm"
            />
            <input
              name="leadTimeDays"
              type="number"
              min="0"
              placeholder="Días de entrega"
              className="h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm"
            />
            <TiendasOnPrimaryButton type="submit" className="w-full">
              Guardar proveedor
            </TiendasOnPrimaryButton>
          </form>
        </div>
      </div>
    </TiendasOnScreen>
  );
}
