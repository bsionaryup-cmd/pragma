"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPropertyIcalExportUrlAction } from "@/features/properties/actions/airbnb-sync.actions";
import { Button } from "@/components/ui/button";

type PropertyIcalExportLinkProps = {
  propertyId: string;
  className?: string;
};

export function PropertyIcalExportLink({
  propertyId,
  className,
}: PropertyIcalExportLinkProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const urlRef = useRef<string | null>(null);

  const loadUrl = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPropertyIcalExportUrlAction(propertyId);
      urlRef.current = result.url;
      setUrl(result.url);
      return result.url;
    } catch {
      toast.error("No se pudo generar el enlace de exportación");
      return null;
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void loadUrl();
  }, [loadUrl]);

  async function handleExportClick() {
    setCopying(true);
    try {
      const link = url ?? urlRef.current ?? (await loadUrl());
      if (!link) return;

      await navigator.clipboard.writeText(link);
      toast.success(
        "Enlace .ics copiado — pégalo en Airbnb → Calendario → Importar calendario",
      );
    } catch {
      toast.error("No se pudo copiar el enlace");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading || copying}
        onClick={() => void handleExportClick()}
      >
        {loading || copying ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CalendarPlus className="mr-2 h-3.5 w-3.5" />
        )}
        Exportar calendario
      </Button>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Compatible con Airbnb, Google Calendar y Apple Calendar. Incluye reservas
        activas, futuras y bloqueos manuales creados en PRAGMA.
      </p>
      {url ? (
        <p className="mt-1.5 break-all font-mono text-[10px] text-muted-foreground/80">
          {url}
        </p>
      ) : null}
    </div>
  );
}
