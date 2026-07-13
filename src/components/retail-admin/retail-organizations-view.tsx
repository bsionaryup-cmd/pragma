import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { listRetailOrganizations } from "@/modules/retail-admin/services/retail-admin-store.service";

type OrgRow = Awaited<ReturnType<typeof listRetailOrganizations>>[number];

export function RetailOrganizationsView({ organizations }: { organizations: OrgRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Organización</th>
            <th className="px-4 py-3">Estado org</th>
            <th className="px-4 py-3">Tienda</th>
            <th className="px-4 py-3">Usuarios</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {organizations.map((org) => (
            <tr key={org.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{org.name}</td>
              <td className="px-4 py-3">
                <Badge variant={org.status === "ACTIVE" ? "default" : "secondary"}>
                  {org.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                {org.store ? (
                  <span>
                    {org.store.name}{" "}
                    <span className="text-muted-foreground">({org.store.status})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sin tienda</span>
                )}
              </td>
              <td className="px-4 py-3">{org.usersCount}</td>
              <td className="px-4 py-3 text-right">
                {org.store ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/owner-dashboard/intiendas/tiendas/${org.store.id}`}>Ver tienda</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/owner-dashboard/intiendas/tiendas">Crear tienda</Link>
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {organizations.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                No hay organizaciones.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
