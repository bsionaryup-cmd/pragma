import { getMovementsData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasDateTime } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailMovementsPage() {
  const movements = await getMovementsData();
  return (
    <TiendasOnScreen title="Movimientos">
      <TiendasOnTable>
        <TiendasOnTableHead>
          <TiendasOnTh>Fecha</TiendasOnTh>
          <TiendasOnTh>Producto</TiendasOnTh>
          <TiendasOnTh>Tipo</TiendasOnTh>
          <TiendasOnTh>Cantidad</TiendasOnTh>
          <TiendasOnTh>Saldo</TiendasOnTh>
        </TiendasOnTableHead>
        <tbody>
          {movements.map((row) => (
            <tr key={row.id}>
              <TiendasOnTd>{formatIntiendasDateTime(row.createdAt)}</TiendasOnTd>
              <TiendasOnTd>{row.product?.name ?? "—"}</TiendasOnTd>
              <TiendasOnTd>{row.type}</TiendasOnTd>
              <TiendasOnTd>{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</TiendasOnTd>
              <TiendasOnTd>{row.balanceAfter}</TiendasOnTd>
            </tr>
          ))}
        </tbody>
      </TiendasOnTable>
    </TiendasOnScreen>
  );
}
