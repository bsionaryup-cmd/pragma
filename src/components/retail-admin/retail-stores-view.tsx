"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  activateRetailStoreAction,
  createRetailStoreAction,
  softDeleteRetailStoreAction,
  suspendRetailStoreAction,
} from "@/features/retail-admin/actions/store.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StoreRow = {
  id: string;
  name: string;
  organizationName: string;
  organizationId: string;
  status: string;
  deletedAt: string | null;
  usersCount: number;
  salesLast30Days: number;
};

export function RetailStoresView({
  stores,
  organizations,
  query,
}: {
  stores: StoreRow[];
  organizations: Array<{ id: string; name: string }>;
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [name, setName] = useState("");

  function run(action: () => Promise<{ success: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function createStore(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createRetailStoreAction({ organizationId, name });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Tienda creada");
      router.push(`/owner-dashboard/intiendas/tiendas/${result.storeId}`);
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <form className="grid gap-3 rounded-2xl border bg-card p-5 shadow-pragma-soft md:grid-cols-[1fr_1fr_auto]" onSubmit={createStore}>
        <div>
          <Label htmlFor="organization">Organización sin tienda</Label>
          <select id="organization" className="mt-1 h-9 w-full rounded-md border bg-card px-3 text-sm" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required>
            {organizations.length ? organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>) : <option value="">No hay organizaciones disponibles</option>}
          </select>
        </div>
        <div>
          <Label htmlFor="store-name">Nombre de la tienda</Label>
          <Input id="store-name" className="mt-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Tienda Centro" required />
        </div>
        <Button className="self-end" disabled={pending || !organizationId}><Plus className="mr-2 h-4 w-4" />Crear tienda</Button>
      </form>

      <form className="relative" action="/owner-dashboard/intiendas/tiendas">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={query} className="pl-9" placeholder="Buscar tienda u organización…" />
      </form>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-pragma-soft">
        <Table>
          <TableHeader><TableRow><TableHead>Tienda</TableHead><TableHead>Organización</TableHead><TableHead>Usuarios</TableHead><TableHead>Ventas 30 días</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
          <TableBody>
            {stores.length ? stores.map((store) => (
              <TableRow key={store.id}>
                <TableCell><Link className="font-medium hover:text-pragma-electric" href={`/owner-dashboard/intiendas/tiendas/${store.id}`}>{store.name}</Link></TableCell>
                <TableCell>{store.organizationName}</TableCell>
                <TableCell>{store.usersCount}</TableCell>
                <TableCell>{store.salesLast30Days}</TableCell>
                <TableCell><Badge variant="outline">{store.deletedAt ? "Eliminada" : store.status === "ACTIVE" ? "Activa" : "Suspendida"}</Badge></TableCell>
                <TableCell><div className="flex justify-end gap-1">
                  {store.status === "ACTIVE" && !store.deletedAt ? (
                    <Button size="icon" variant="ghost" title="Suspender" disabled={pending} onClick={() => run(() => suspendRetailStoreAction(store.id), "Tienda suspendida")}><Power className="h-4 w-4" /></Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => activateRetailStoreAction(store.id), "Tienda activada")}>Activar</Button>
                  )}
                  {!store.deletedAt ? <Button size="icon" variant="ghost" title="Eliminar" disabled={pending} onClick={() => window.confirm("¿Eliminar esta tienda de forma lógica?") && run(() => softDeleteRetailStoreAction(store.id), "Tienda eliminada")}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}
                </div></TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No hay tiendas para mostrar.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
