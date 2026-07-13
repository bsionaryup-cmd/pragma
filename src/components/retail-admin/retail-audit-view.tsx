import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function RetailAuditView({
  logs,
}: {
  logs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorUserId: string | null;
    createdAt: Date;
    store: { id: string; name: string };
  }>;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-pragma-soft">
      <Table>
        <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tienda</TableHead><TableHead>Acción</TableHead><TableHead>Entidad</TableHead><TableHead>Actor</TableHead></TableRow></TableHeader>
        <TableBody>
          {logs.length ? logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{log.createdAt.toLocaleString("es-CO")}</TableCell>
              <TableCell>{log.store.name}</TableCell>
              <TableCell className="font-medium">{log.action}</TableCell>
              <TableCell>{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</TableCell>
              <TableCell>{log.actorUserId ?? "Sistema"}</TableCell>
            </TableRow>
          )) : <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No hay eventos de auditoría registrados.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}
