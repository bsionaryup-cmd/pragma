import { getMovementsData } from "@/domains/retail/services/retail-ui.service";
import { CashGateBanner, hasOpenCash } from "@/domains/retail/ui/tiendas-on/cash-gate";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasDateTime } from "@/domains/retail/ui/tiendas-on/format";
import { movementTypeLabel } from "@/domains/retail/ui/tiendas-on/labels";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailMovementsPage() {
  const cashOpen = await hasOpenCash();
  const movements = cashOpen ? await getMovementsData() : [];
  return (
    <TiendasOnScreen title="Movimientos">
      <CashGateBanner moduleLabel="Movimientos" />
      {cashOpen ? (
        <TiendasOnTable>
          <TiendasOnTableHead>
            <TiendasOnTh className="text-base">Fecha</TiendasOnTh>
            <TiendasOnTh className="text-base">Producto</TiendasOnTh>
            <TiendasOnTh className="text-base">Tipo</TiendasOnTh>
            <TiendasOnTh className="text-base">Cantidad</TiendasOnTh>
            <TiendasOnTh className="text-base">Saldo</TiendasOnTh>
          </TiendasOnTableHead>
          <tbody>
            {movements.map((row) => (
              <tr key={row.id}>
                <TiendasOnTd className="text-base">{formatIntiendasDateTime(row.createdAt)}</TiendasOnTd>
                <TiendasOnTd className="text-base">{row.product?.name ?? "—"}</TiendasOnTd>
                <TiendasOnTd className="text-base">{movementTypeLabel(row.type)}</TiendasOnTd>
                <TiendasOnTd className="text-base">
                  {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                </TiendasOnTd>
                <TiendasOnTd className="text-base">{row.balanceAfter}</TiendasOnTd>
              </tr>
            ))}
          </tbody>
        </TiendasOnTable>
      ) : null}
    </TiendasOnScreen>
  );
}
