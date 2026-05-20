import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type FirstPropertyBannerProps = {
  canCreate: boolean;
};

export function FirstPropertyBanner({ canCreate }: FirstPropertyBannerProps) {
  if (!canCreate) return null;

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#0E9F8D]/20 bg-pragma-gradient p-8 text-white shadow-pragma-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/10">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Crea tu primera propiedad</h2>
          <p className="mt-1 max-w-lg text-sm text-primary-foreground/80">
            Registra un alojamiento para usarlo en reservas, calendario y
            operación diaria del PMS.
          </p>
        </div>
      </div>
      <Button
        asChild
        className="h-11 shrink-0 rounded-full bg-foreground px-6 text-background hover:bg-foreground/90"
      >
        <Link href="/properties?create=true">
          <Plus className="mr-2 h-4 w-4" />
          Crear propiedad
        </Link>
      </Button>
    </div>
  );
}
