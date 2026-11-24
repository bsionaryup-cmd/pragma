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

  const message = error.message ?? "";
  const isProdBuild = process.env.NODE_ENV === "production";
  const isSchemaDrift =
    /P2022|ColumnNotFound|does not exist in the current database/i.test(message);
  const isDb =
    isSchemaDrift ||
    /database|prisma|P1001|ECONNREFUSED|timeout|OperationTimeout|base de datos/i.test(
      message,
    );
  const isRedactedServerError =
    isProdBuild &&
    Boolean(error.digest) &&
    (/omitted in production|An error occurred in the Server Components render/i.test(
      message,
    ) ||
      !message.trim());

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        {isSchemaDrift
          ? "Base de datos desactualizada"
          : isDb
            ? "No se pudo conectar con la base de datos"
            : "Algo salió mal"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {isSchemaDrift
          ? "Falta aplicar una migración reciente. En local: npm run db:migrate:deploy && npm run dev:clean && npm run dev"
          : isDb
            ? "Comprueba la conexión a PostgreSQL / Neon y que DATABASE_URL sea correcta. Luego recarga."
            : isRedactedServerError
              ? "El servidor reportó un error al renderizar este módulo. Pulsa Reintentar. Si persiste, revisa los logs del servidor (digest en consola) — no suele resolverse solo reiniciando el cliente."
              : isProdBuild
                ? "Prueba de nuevo con Reintentar. Si el problema continúa, vuelve al inicio o contacta soporte."
                : "Prueba de nuevo. Si el problema continúa y el servidor local no responde, reinicia con npm run dev:clean && npm run dev."}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          digest: {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Reintentar
        </button>
        <Link
          href="/panel"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Ir al panel
        </Link>
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
