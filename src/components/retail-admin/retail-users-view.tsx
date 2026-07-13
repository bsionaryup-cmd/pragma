"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  createRetailAccountAction,
  deleteRetailAccountAction,
  setRetailAccountActiveAction,
  updateRetailAccountAction,
} from "@/features/retail-admin/actions/user.actions";
import type { RetailAccountListItem } from "@/modules/retail-admin/services/retail-admin-user.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCop } from "@/domains/retail/lib/money";

const money = (value: number) => formatCop(value);

function planLabel(plan: "MONTHLY" | "LIFETIME" | null) {
  if (plan === "LIFETIME") return "Acceso vitalicio";
  if (plan === "MONTHLY") return "Mensualidad";
  return "—";
}

type FormState = {
  businessName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accessPlan: "MONTHLY" | "LIFETIME";
  billingAmount: string;
};

const emptyForm: FormState = {
  businessName: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  accessPlan: "MONTHLY",
  billingAmount: "0",
};

export function RetailUsersView({ users }: { users: RetailAccountListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(user: RetailAccountListItem) {
    setEditingId(user.id);
    setForm({
      businessName: user.storeName ?? "",
      email: user.email,
      password: "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      accessPlan: user.accessPlan ?? "MONTHLY",
      billingAmount: String(user.billingAmount ?? 0),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const billingAmount = Number(form.billingAmount);
    startTransition(async () => {
      if (editingId) {
        const result = await updateRetailAccountAction({
          userId: editingId,
          businessName: form.businessName,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          accessPlan: form.accessPlan,
          billingAmount,
          password: form.password || undefined,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Usuario actualizado");
        cancelEdit();
        router.refresh();
        return;
      }

      const result = await createRetailAccountAction({
        businessName: form.businessName,
        email: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        accessPlan: form.accessPlan,
        billingAmount,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Usuario listo. Ya puede ingresar en /intiendas/login");
      setForm(emptyForm);
      router.refresh();
    });
  }

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-pragma-soft"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">
              {editingId ? "Editar usuario INTIENDAS" : "Crear usuario INTIENDAS"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Cada usuario es un negocio con su propia tienda. Usará este correo y
              contraseña en /intiendas/login. Si el correo ya existía y estaba
              eliminado, se reactivará automáticamente.
            </p>
          </div>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={pending}>
              Cancelar edición
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <Label htmlFor="businessName">Negocio / tienda</Label>
            <Input
              id="businessName"
              className="mt-1"
              value={form.businessName}
              onChange={(e) => setField("businessName", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Correo de acceso</Label>
            <Input
              id="email"
              className="mt-1"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required={!editingId}
              disabled={Boolean(editingId)}
            />
          </div>
          <div>
            <Label htmlFor="password">
              {editingId ? "Nueva contraseña (opcional)" : "Contraseña"}
            </Label>
            <Input
              id="password"
              className="mt-1"
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              required={!editingId}
              minLength={editingId ? undefined : 8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="firstName">Nombre</Label>
            <Input
              id="firstName"
              className="mt-1"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Apellido</Label>
            <Input
              id="lastName"
              className="mt-1"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="accessPlan">Tipo de acceso</Label>
            <select
              id="accessPlan"
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
              value={form.accessPlan}
              onChange={(e) =>
                setField("accessPlan", e.target.value as FormState["accessPlan"])
              }
            >
              <option value="MONTHLY">Mensualidad</option>
              <option value="LIFETIME">Acceso vitalicio</option>
            </select>
          </div>
          <div>
            <Label htmlFor="billingAmount">Cuánto paga (COP)</Label>
            <Input
              id="billingAmount"
              className="mt-1"
              type="number"
              min={0}
              step="1000"
              value={form.billingAmount}
              onChange={(e) => setField("billingAmount", e.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          <Plus className="mr-2 h-4 w-4" />
          {editingId ? "Guardar cambios" : "Crear usuario"}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-pragma-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acceso</TableHead>
              <TableHead>Paga</TableHead>
              <TableHead>Último ingreso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-foreground">
                    {user.storeName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">{user.email}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        user.accountLabel === "Activo"
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                          : "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800"
                      }
                    >
                      {user.accountLabel}
                    </span>
                  </TableCell>
                  <TableCell>{planLabel(user.accessPlan)}</TableCell>
                  <TableCell>
                    {user.accessPlan === "LIFETIME"
                      ? `${money(user.billingAmount)} (único)`
                      : `${money(user.billingAmount)} / mes`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLoginAt
                      ? new Intl.DateTimeFormat("es-CO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(user.lastLoginAt)
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        disabled={pending}
                        onClick={() => startEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={user.accountLabel === "Activo" ? "Desactivar" : "Activar"}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              setRetailAccountActiveAction({
                                userId: user.id,
                                isActive: user.accountLabel !== "Activo",
                              }),
                            user.accountLabel === "Activo"
                              ? "Usuario desactivado"
                              : "Usuario activado",
                          )
                        }
                      >
                        {user.accountLabel === "Activo" ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Eliminar"
                        disabled={pending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `¿Eliminar la cuenta de ${user.email}? No podrá ingresar a INTIENDAS.`,
                            )
                          ) {
                            return;
                          }
                          run(() => deleteRetailAccountAction(user.id), "Usuario eliminado");
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aún no hay usuarios. Crea el primero para que pueda entrar en /intiendas/login.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
