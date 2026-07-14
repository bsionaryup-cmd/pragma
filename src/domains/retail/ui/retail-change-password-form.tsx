"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useTransition } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { validateNewAccountPassword } from "@/lib/auth/password-rules";

/** Cambio de contraseña autentificado vía Clerk (sin backend propio). */
export function RetailChangePasswordForm() {
  const { user, isLoaded } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        if (!user) throw new Error("Sesión no disponible. Vuelve a iniciar sesión.");

        const policyError = validateNewAccountPassword(newPassword);
        if (policyError) throw new Error(policyError);
        if (newPassword !== confirmPassword) {
          throw new Error("La confirmación no coincide con la nueva contraseña.");
        }
        if (!currentPassword) throw new Error("Ingresa tu contraseña actual.");

        await user.updatePassword({
          currentPassword,
          newPassword,
          signOutOfOtherSessions: true,
        });

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("Contraseña actualizada. Usa la nueva clave en el próximo ingreso.");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo cambiar la contraseña.";
        setError(
          message.includes("incorrect") || message.includes("Incorrect")
            ? "La contraseña actual no es correcta."
            : message,
        );
      }
    });
  }

  if (!isLoaded) {
    return <p className="text-sm text-[#718096]">Cargando…</p>;
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </div>
      ) : null}

      <PasswordInput
        id="retail-current-password"
        label="Contraseña actual"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        required
      />
      <PasswordInput
        id="retail-new-password"
        label="Nueva contraseña"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        onFocus={() => setFocused(true)}
        required
      />
      {focused || newPassword ? (
        <PasswordRequirements password={newPassword} visible={focused || newPassword.length > 0} />
      ) : null}
      <PasswordInput
        id="retail-confirm-password"
        label="Confirmar nueva contraseña"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        required
      />

      <TiendasOnPrimaryButton type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </TiendasOnPrimaryButton>
    </form>
  );
}
