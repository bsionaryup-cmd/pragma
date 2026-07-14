import { BookOpen, Shield } from "lucide-react";
import Link from "next/link";
import { RetailChangePasswordForm } from "@/domains/retail/ui/retail-change-password-form";
import { TiendasOnSummaryCard } from "@/domains/retail/ui/tiendas-on/data-display";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default function RetailSecurityPage() {
  return (
    <TiendasOnScreen title="Seguridad" backHref="/intiendas/configuracion">
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <TiendasOnSummaryCard
          title="Cambiar contraseña"
          accent="pragma"
          icon={<Shield className="size-5 text-pragma-electric" />}
        >
          <p className="mb-4 text-sm text-[#718096]">
            Mantener una contraseña segura ayuda a proteger la información del negocio. El cambio
            usa el proveedor de autenticación Clerk; no guardamos claves en INTIENDAS.
          </p>
          <RetailChangePasswordForm />
        </TiendasOnSummaryCard>
        <p className="text-center text-sm text-[#718096]">
          <Link
            href="/intiendas/configuracion/ayuda/seguridad-contrasena"
            className="inline-flex items-center gap-1 text-pragma-electric hover:underline"
          >
            <BookOpen className="size-4" />
            Ver ayuda sobre contraseñas
          </Link>
        </p>
      </div>
    </TiendasOnScreen>
  );
}
