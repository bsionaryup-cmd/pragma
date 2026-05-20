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

const roleBadgeVariant = {
  ADMIN: "default" as const,
  OPERATIONS: "secondary" as const,
};

export default async function UsersPage() {
  const current = await requirePermission("users:read");
  const users = await listUsers();

  return (
      <main className="flex-1 overflow-y-auto p-6">
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
      </main>
  );
}
