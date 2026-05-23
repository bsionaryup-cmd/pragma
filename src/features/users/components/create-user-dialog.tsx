"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRole } from "@prisma/client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAction } from "@/features/users/actions/user.actions";
import {
  createUserSchema,
  type CreateUserValues,
} from "@/features/users/schemas/user.schema";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  RECEPTIONIST: "Recepcionista",
};

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [passwordFocused, setPasswordFocused] = useState(false);

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: UserRole.RECEPTIONIST,
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const showPasswordRules = passwordFocused || password.length > 0;

  function onSubmit(values: CreateUserValues) {
    startTransition(async () => {
      try {
        await createUserAction(values);
        toast.success("Usuario creado. Ya puede iniciar sesión con su correo y contraseña.");
        form.reset();
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo crear el usuario",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo usuario</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            Define correo y contraseña. El recepcionista accederá solo con esas
            credenciales.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(UserRole).map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PasswordInput
                        id="create-user-password"
                        label="Contraseña"
                        value={field.value}
                        onChange={field.onChange}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        autoComplete="new-password"
                        placeholder="Contraseña inicial"
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <PasswordRequirements password={password} visible={showPasswordRules} />
            </div>
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PasswordInput
                      id="create-user-confirm-password"
                      label="Confirmar contraseña"
                      value={field.value}
                      onChange={field.onChange}
                      autoComplete="new-password"
                      placeholder="Repite la contraseña"
                      required
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Creando…" : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
