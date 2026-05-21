import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActiveToggle } from "@/features/users/components/user-active-toggle";
import { UserRoleSelect } from "@/features/users/components/user-role-select";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/helpers/date";
import { listUsers } from "@/services/users/user.service";
import { listRecentLoginActivities } from "@/services/users/login-activity.service";
import { roleLabel } from "@/lib/auth/permissions";

const roleBadgeVariant = {
  ADMIN: "default" as const,
  RECEPTIONIST: "secondary" as const,
};

export default async function UsersPage() {
  const current = await requirePermission("users:read");
  const [users, loginActivity] = await Promise.all([
    listUsers(),
    listRecentLoginActivities(40),
  ]);

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          title="Equipo"
          description={`${users.length} usuarios registrados`}
        />
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === current.dbUserId;
                const name =
                  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  "—";

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <UserRoleSelect
                        userId={user.id}
                        currentRole={user.role}
                        disabled={isSelf}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.isActive ? roleBadgeVariant[user.role] : "outline"
                        }
                      >
                        {user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActiveToggle
                        userId={user.id}
                        isActive={user.isActive}
                        disabled={isSelf}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">Actividad de inicio de sesión</h2>
          <p className="text-sm text-muted-foreground">
            Últimos accesos, más recientes primero.
          </p>
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loginActivity.map((entry) => {
                  const name =
                    [entry.user.firstName, entry.user.lastName]
                      .filter(Boolean)
                      .join(" ") || entry.user.email;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <p className="font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabel(entry.user.role)}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.deviceLabel ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.ipAddress ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </ModuleShellFlow>
  );
}
