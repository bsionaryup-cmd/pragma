import { Suspense } from "react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { RetailForgotPasswordForm } from "@/domains/retail/ui/retail-forgot-password-form";
import { INTIENDAS_VERSION } from "@/domains/retail/ui/tiendas-on/modules";

export default function RetailForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#eef1f4] text-[#2d3748]">
      <header className="flex h-14 items-center justify-center border-b border-[#d9dee5] bg-white px-4">
        <div className="flex items-center gap-3">
          <PragmaLogo variant="mark" symbolClassName="h-9 w-8" priority />
          <div>
            <PragmaLogo variant="full" tone="light" fullClassName="h-5 w-auto" />
            <p className="text-[10px] font-bold tracking-[0.24em] text-pragma-electric">INTIENDAS</p>
          </div>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-md border border-[#d5dce6] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
            <p className="mt-1 text-sm text-[#718096]">
              Te enviaremos un código a tu correo si la cuenta está registrada.
            </p>
          </div>
          <Suspense fallback={<p className="text-center text-sm text-[#718096]">Cargando…</p>}>
            <RetailForgotPasswordForm />
          </Suspense>
        </div>
      </section>

      <footer className="border-t border-[#d9dee5] bg-white px-4 py-2 text-center text-xs text-[#94a3b8]">
        PRAGMA INTIENDAS v{INTIENDAS_VERSION}
      </footer>
    </main>
  );
}
