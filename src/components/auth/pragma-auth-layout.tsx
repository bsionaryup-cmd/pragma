import { APP_NAME } from "@/lib/constants";

type PragmaAuthLayoutProps = {
  children: React.ReactNode;
  hint?: React.ReactNode;
};

export function PragmaAuthLayout({ children, hint }: PragmaAuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-pragma-soft-gray via-background to-background lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between border-r border-border/60 bg-card/40 p-10 lg:flex">
        <div>
          <p className="font-accent text-2xl font-bold tracking-tight text-foreground">
            {APP_NAME}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Gestión hotelera unificada: reservas, calendario, finanzas e
            integraciones en un solo Command Center.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Seguro · Minimal · Listo para producción
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 text-center lg:hidden">
          <p className="font-accent text-xl font-bold">{APP_NAME}</p>
        </div>
        {hint}
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 shadow-pragma-soft sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
