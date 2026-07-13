import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/domains/retail/actions/retail.actions";
import { getSuppliersData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { TiendasOnActionBar, TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

const LEAD_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 15, 30];

export default async function RetailSuppliersPage() {
  const suppliers = await getSuppliersData();
  return (
    <TiendasOnScreen title="Proveedores" backHref="/intiendas/inventario">
      <TiendasOnActionBar>
        <p className="text-base text-[#718096]">{suppliers.length} proveedores</p>
      </TiendasOnActionBar>

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_340px]">
        <TiendasOnTable>
          <TiendasOnTableHead>
            <TiendasOnTh className="text-base">Proveedor</TiendasOnTh>
            <TiendasOnTh className="text-base">Contacto</TiendasOnTh>
            <TiendasOnTh className="text-base">Entrega</TiendasOnTh>
            <TiendasOnTh className="text-base">Acciones</TiendasOnTh>
          </TiendasOnTableHead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <TiendasOnTd className="text-base font-medium">{supplier.name}</TiendasOnTd>
                <TiendasOnTd className="text-base">
                  <p>{supplier.contactName || "—"}</p>
                  <p className="text-sm text-[#94a3b8]">
                    {supplier.phone || supplier.email || "Sin contacto"}
                  </p>
                </TiendasOnTd>
                <TiendasOnTd className="text-base">{supplier.leadTimeDays} días</TiendasOnTd>
                <TiendasOnTd>
                  <details>
                    <summary className="cursor-pointer text-base text-pragma-electric">Editar</summary>
                    <form action={updateSupplierAction} className="mt-2 space-y-2 rounded border p-2">
                      <input type="hidden" name="id" value={supplier.id} />
                      <input name="name" defaultValue={supplier.name} required className="h-9 w-full rounded border px-2 text-sm" />
                      <input name="contactName" defaultValue={supplier.contactName ?? ""} placeholder="Contacto" className="h-9 w-full rounded border px-2 text-sm" />
                      <input name="phone" defaultValue={supplier.phone ?? ""} placeholder="Teléfono" className="h-9 w-full rounded border px-2 text-sm" />
                      <input name="email" defaultValue={supplier.email ?? ""} placeholder="Correo" className="h-9 w-full rounded border px-2 text-sm" />
                      <select name="leadTimeDays" defaultValue={String(supplier.leadTimeDays)} className="h-9 w-full rounded border px-2 text-sm">
                        {LEAD_OPTIONS.map((d) => (
                          <option key={d} value={d}>{d === 0 ? "Mismo día" : `${d} días`}</option>
                        ))}
                      </select>
                      <TiendasOnPrimaryButton type="submit" className="h-9 w-full text-sm">Guardar</TiendasOnPrimaryButton>
                    </form>
                  </details>
                  <form action={deleteSupplierAction} className="mt-2">
                    <input type="hidden" name="id" value={supplier.id} />
                    <button type="submit" className="text-sm text-red-500">Eliminar</button>
                  </form>
                </TiendasOnTd>
              </tr>
            ))}
          </tbody>
        </TiendasOnTable>

        <div className="rounded-md border border-[#d5dce6] bg-white p-4">
          <h3 className="mb-3 text-base font-semibold text-[#2d3748]">Nuevo proveedor</h3>
          <form action={createSupplierAction} className="space-y-3">
            <input name="name" placeholder="Nombre comercial" required className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base" />
            <input name="contactName" placeholder="Persona de contacto" className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base" />
            <input name="phone" type="tel" placeholder="Teléfono" className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base" />
            <input name="email" type="email" placeholder="Correo" className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base" />
            <label className="block text-sm text-[#718096]">
              Días de entrega
              <select name="leadTimeDays" defaultValue="3" className="mt-1 h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base">
                {LEAD_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d === 0 ? "Mismo día" : `${d} días`}</option>
                ))}
              </select>
            </label>
            <TiendasOnPrimaryButton type="submit" className="w-full text-base">
              Guardar proveedor
            </TiendasOnPrimaryButton>
          </form>
        </div>
      </div>
    </TiendasOnScreen>
  );
}
