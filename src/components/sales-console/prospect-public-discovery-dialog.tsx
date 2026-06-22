"use client";

import { ExternalLink, Globe, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { discoverPublicProspectsAction } from "@/features/sales-console/actions/public-discovery.actions";
import {
  buildPublicSearchLinks,
  buildPublicSearchQuery,
} from "@/modules/sales-console/discovery/public-discovery.urls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ProspectPublicDiscoveryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenImport: () => void;
  onSuccess: () => void;
};

export function ProspectPublicDiscoveryDialog({
  open,
  onOpenChange,
  onOpenImport,
  onSuccess,
}: ProspectPublicDiscoveryDialogProps) {
  const [searchQuery, setSearchQuery] = useState("administración de propiedades");
  const [city, setCity] = useState("");
  const [pending, setPending] = useState(false);

  const searchLinks = useMemo(
    () => buildPublicSearchLinks(searchQuery, city),
    [searchQuery, city],
  );

  function openAllPublicSearches() {
    const query = buildPublicSearchQuery(searchQuery, city);
    if (!query.trim()) {
      toast.error("Indica qué buscar o en qué ciudad");
      return;
    }

    for (const link of searchLinks) {
      window.open(link.href, "_blank", "noopener,noreferrer");
    }
    toast.success("Búsquedas públicas abiertas en nuevas pestañas");
  }

  function openSingleSearch(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function handleImportOpenData(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    try {
      const result = await discoverPublicProspectsAction({ searchQuery, city });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const skippedParts: string[] = [];
      if (result.skippedDuplicate > 0) {
        skippedParts.push(`${result.skippedDuplicate} duplicados`);
      }
      if (result.skippedInvalid > 0) {
        skippedParts.push(`${result.skippedInvalid} inválidos`);
      }
      const skippedText =
        skippedParts.length > 0 ? ` · Omitidos: ${skippedParts.join(", ")}` : "";

      toast.success(`Importados ${result.imported} prospectos desde datos públicos${skippedText}`);
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("No fue posible importar datos públicos");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Explorar fuentes públicas</DialogTitle>
          <DialogDescription>
            Sin API keys. Abre la web pública en tu navegador o importa datos abiertos de
            OpenStreetMap. Para Google Maps con teléfonos, copia resultados y usa Importar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleImportOpenData} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="public-search-query">Qué buscar</Label>
              <Input
                id="public-search-query"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="administración de propiedades"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="public-search-city">Ciudad</Label>
              <Input
                id="public-search-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Medellín"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">1. Buscar en la web pública</p>
            <p className="text-xs text-muted-foreground">
              Se abren sitios públicos en tu navegador. Copia nombre, teléfono y web → Importar.
            </p>
            <div className="flex flex-wrap gap-2">
              {searchLinks.map((link) => (
                <Button
                  key={link.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openSingleSearch(link.href)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {link.label}
                </Button>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={openAllPublicSearches}>
              Abrir todas las búsquedas
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">
              2. Importar datos abiertos (OpenStreetMap)
            </p>
            <p className="text-xs text-muted-foreground">
              Gratis y sin credenciales. Puede traer menos teléfonos que Google Maps.
            </p>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  Importar datos públicos
                </>
              )}
            </Button>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onOpenImport();
              }}
            >
              Ir a Importar (pegar resultados)
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
