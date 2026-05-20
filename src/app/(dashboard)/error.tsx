"use client";

import { useEffect } from "react";
import Link from "next/link";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  const isDb =
    /database|prisma|P1001|ECONNREFUSED|timeout|OperationTimeout/i.test(
      error.message,
    );

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        {isDb ? "No se pudo conectar con la base de datos" : "Algo salió mal"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {isDb
          ? "Comprueba que PostgreSQL esté en marcha y que DATABASE_URL en .env.local sea correcta. Luego recarga la página."
          : "Prueba de nuevo. Si el problema continúa, reinicia el servidor con npm run dev:clean y npm run dev."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
