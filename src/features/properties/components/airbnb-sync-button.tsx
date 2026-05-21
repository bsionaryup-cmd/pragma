"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  runAirbnbAutoSync,
  runPropertyAirbnbSync,
} from "@/lib/airbnb/auto-sync-client";
import { dispatchAirbnbSyncComplete } from "@/lib/airbnb-sync";
import { cn } from "@/lib/utils";

type AirbnbSyncButtonProps = {
  propertyId?: string;
  className?: string;
  variant?: "header" | "detail";
};

export function AirbnbSyncButton({
  propertyId,
  className,
  variant = "header",
}: AirbnbSyncButtonProps) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();

  function handleSync() {
    startSync(async () => {
      try {
        if (propertyId) {
          const result = await runPropertyAirbnbSync(propertyId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          dispatchAirbnbSyncComplete({
            created: result.created,
            updated: result.updated,
            cancelled: result.cancelled,
            propertiesSynced: 1,
            errors: result.error ? 1 : 0,
          });
          const parts = [
            `+${result.created} nuevas`,
            `${result.updated} actualizadas`,
          ];
          if (result.cancelled > 0) parts.push(`${result.cancelled} canceladas`);
          if (result.skipped > 0) parts.push(`${result.skipped} omitidas`);
          toast.success(`${result.propertyName}: ${parts.join(", ")}`);
        } else {
          const summary = await runAirbnbAutoSync();
          if (summary.propertiesSynced === 0) {
            toast.message("No hay propiedades con iCal de Airbnb");
            return;
          }
          if (summary.errors > 0 && summary.created === 0 && summary.updated === 0) {
            toast.error("Error al sincronizar Airbnb");
            return;
          }
          dispatchAirbnbSyncComplete(summary);
          const parts = [
            `${summary.created} nuevas`,
            `${summary.updated} actualizadas`,
          ];
          if (summary.cancelled > 0) parts.push(`${summary.cancelled} canceladas`);
          toast.success(`Sincronizado: ${parts.join(", ")}`);
        }
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "No se pudo sincronizar Airbnb",
        );
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={syncing}
      onClick={handleSync}
      className={cn(
        variant === "header"
          ? "h-10 rounded-full border-border px-5"
          : "h-9 rounded-full",
        className,
      )}
    >
      {syncing ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Sincronizar ahora
    </Button>
  );
}
