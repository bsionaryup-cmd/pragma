import { ModuleShellFlow } from "@/components/layout/module-shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import { DeleteUserButton } from "@/features/users/components/delete-user-button";
import { EditUserDialog } from "@/features/users/components/edit-user-dialog";
import { UserActiveToggle } from "@/features/users/components/user-active-toggle";
import { UserRoleSelect } from "@/features/users/components/user-role-select";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/helpers/date";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";
import { listUsers } from "@/services/users/user.service";
import { listRecentLoginActivities } from "@/services/users/login-activity.service";
import { roleLabel } from "@/lib/auth/permissions";

const roleBadgeVariant = {
  ADMIN: "default" as const,
  RECEPTIONIST: "secondary" as const,
};

export default async function UsersPage() {
  const current = await requirePermission("users:read");
  const canWrite = hasPermission(current.role, "users:write");
  const canDelete = hasPermission(current.role, "users:delete");
  const isCurrentAccountOwner = current.isAccountOwner;
  const organizationId = await getEffectiveOrganizationIdForUser(current.dbUserId);
  const [users, loginActivity] = await Promise.all([
    listUsers({ organizationId }),
    listRecentLoginActivities(40),
  ]);

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Equipo
            </h2>
            <p className="text-sm text-muted-foreground">
              {users.length} usuarios registrados
            </p>
          </div>
          {canWrite ? <CreateUserDialog /> : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="pragma-scrollbar overflow-x-auto">
          <Table className="min-w-[640px]">
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
                const isAccountOwner = user.isAccountOwner;
                const ownerLockedForOthers = isAccountOwner && !isSelf;
                const canDeleteThisUser =
                  canDelete &&
                  !isSelf &&
                  !isAccountOwner &&
                  (user.role !== "ADMIN" || isCurrentAccountOwner);
                const name =
                  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  "—";

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{name}</span>
                        {isAccountOwner ? (
                          <Badge variant="outline">Dueño de la cuenta</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <UserRoleSelect
                        userId={user.id}
                        currentRole={user.role}
                        disabled={isSelf || isAccountOwner || !canWrite}
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
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canWrite ? (
                          <EditUserDialog
                            userId={user.id}
                            email={user.email}
                            firstName={user.firstName}
                            lastName={user.lastName}
                            disabled={!user.isActive || ownerLockedForOthers}
                          />
                        ) : null}
                        {canWrite ? (
                          <UserActiveToggle
                            userId={user.id}
                            isActive={user.isActive}
                            disabled={isSelf || isAccountOwner}
                          />
                        ) : null}
                        {canDeleteThisUser ? (
                          <DeleteUserButton
                            userId={user.id}
                            email={user.email}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">Actividad de inicio de sesión</h2>
          <p className="text-sm text-muted-foreground">
            Últimos accesos, más recientes primero.
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="pragma-scrollbar overflow-x-auto">
            <Table className="min-w-[520px]">
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
          </div>
        </section>
      </main>
    </ModuleShellFlow>
  );
}
