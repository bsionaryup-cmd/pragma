"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { updateRetailStoreAction } from "@/features/retail-admin/actions/store.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Detail = {
  id: string;
  name: string;
  currency: string;
  status: string;
  deletedAt: string | null;
  organization: { id: string; name: string; status: string } | null;
  users: Array<{ id: string; email: string; firstName: string | null; lastName: string | null; role: string; isActive: boolean; isAccountOwner: boolean }>;
  cashRegisters: Array<{ id: string; name: string; status: string }>;
  counts: { products: number; sales: number; customers: number; suppliers: number };
  auditLogs: Array<{ id: string; action: string; entityType: string; createdAt: string }>;
};

export function RetailStoreDetailView({ store }: { store: Detail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(store.name);
  const [currency, setCurrency] = useState(store.currency);

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateRetailStoreAction({ id: store.id, name, currency });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Tienda actualizada");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{store.organization?.name ?? "Organización no encontrada"}</p>
          <Badge variant="outline">{store.deletedAt ? "Eliminada" : store.status === "ACTIVE" ? "Activa" : "Suspendida"}</Badge>
        </div>
        <Link href="/intiendas/dashboard" className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:text-pragma-electric">Abrir tienda operativa <ExternalLink className="ml-2 h-4 w-4" /></Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries({ Productos: store.counts.products, Ventas: store.counts.sales, Clientes: store.counts.customers, Proveedores: store.counts.suppliers }).map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
      </div>

      <form onSubmit={save} className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_180px_auto]">
        <div><Label htmlFor="detail-name">Nombre</Label><Input id="detail-name" className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div><Label htmlFor="currency">Moneda</Label><Input id="currency" className="mt-1" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value)} /></div>
        <Button className="self-end" disabled={pending}><Save className="mr-2 h-4 w-4" />Guardar</Button>
      </form>

      <section className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold">Usuarios de la organización</h3>
        <Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>
          {store.users.map((user) => <TableRow key={user.id}><TableCell>{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}<span className="block text-xs text-muted-foreground">{user.email}</span></TableCell><TableCell>{user.isAccountOwner ? "Owner" : user.role}</TableCell><TableCell>{user.isActive ? "Activo" : "Inactivo"}</TableCell></TableRow>)}
        </TableBody></Table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5"><h3 className="font-semibold">Cajas registradoras</h3><ul className="mt-3 space-y-2 text-sm">{store.cashRegisters.map((register) => <li key={register.id} className="flex justify-between border-b py-2"><span>{register.name}</span><span>{register.status === "ACTIVE" ? "Activa" : "Inactiva"}</span></li>)}</ul></section>
        <section className="rounded-2xl border bg-card p-5"><h3 className="font-semibold">Auditoría reciente</h3><ul className="mt-3 space-y-2 text-sm">{store.auditLogs.map((log) => <li key={log.id} className="border-b py-2"><span className="font-medium">{log.action}</span><span className="block text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("es-CO")} · {log.entityType}</span></li>)}</ul></section>
      </div>
    </div>
  );
}
