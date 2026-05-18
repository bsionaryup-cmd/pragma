"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  syncAirbnbCalendarsAction,
  syncPropertyAirbnbAction,
} from "@/features/properties/actions/airbnb-sync.actions";
import { Button } from "@/components/ui/button";
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
          const { result } = await syncPropertyAirbnbAction(propertyId);
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
          const { summary } = await syncAirbnbCalendarsAction();
          if (summary.propertiesSynced === 0) {
            toast.message("No hay propiedades con iCal de Airbnb");
            return;
          }
          const errors = summary.results.filter((r) => r.error);
          if (errors.length === summary.results.length) {
            toast.error(errors[0]?.error ?? "Error al sincronizar");
            return;
          }
          dispatchAirbnbSyncComplete({
            created: summary.created,
            updated: summary.updated,
            cancelled: summary.cancelled,
            propertiesSynced: summary.propertiesSynced,
            errors: errors.length,
          });
          const parts = [
            `${summary.created} nuevas`,
            `${summary.updated} actualizadas`,
          ];
          if (summary.cancelled > 0) parts.push(`${summary.cancelled} canceladas`);
          if (summary.skipped > 0) parts.push(`${summary.skipped} omitidas`);
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
