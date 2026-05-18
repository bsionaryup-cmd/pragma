"use client";

import {
  Bath,
  BedDouble,
  ExternalLink,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  importAirbnbPropertyAction,
  previewAirbnbListingAction,
} from "@/features/properties/actions/airbnb-import.actions";
import type { PropertyGridItem } from "@/features/properties/types/property.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AirbnbListingPreview } from "@/services/airbnb/airbnb-import.service";
import { cn } from "@/lib/utils";

type AirbnbImportDrawerProps = {
  open: boolean;
  onClose: () => void;
  onImported: (property: PropertyGridItem) => void;
};

export function AirbnbImportDrawer({
  open,
  onClose,
  onImported,
}: AirbnbImportDrawerProps) {
  const [listingUrl, setListingUrl] = useState("");
  const [icalUrl, setIcalUrl] = useState("");
  const [preview, setPreview] = useState<AirbnbListingPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [importing, startImport] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetForm() {
    setListingUrl("");
    setIcalUrl("");
    setPreview(null);
    setPreviewError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const runPreview = useCallback((url: string) => {
    const trimmed = url.trim();
    if (trimmed.length < 12 || !trimmed.includes("airbnb")) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    startPreview(async () => {
      setPreviewError(null);
      try {
        const result = await previewAirbnbListingAction(trimmed);
        setPreview(result.preview);
      } catch (err) {
        setPreview(null);
        setPreviewError(
          err instanceof Error
            ? err.message
            : "No se pudo leer el anuncio. Verifica el enlace.",
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      runPreview(listingUrl);
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [listingUrl, open, runPreview]);

  function handleImport() {
    startImport(async () => {
      try {
        const result = await importAirbnbPropertyAction({
          listingUrl,
          icalUrl,
        });
        toast.success("Propiedad importada desde Airbnb");
        onImported(result.property);
        resetForm();
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al importar la propiedad",
        );
      }
    });
  }

  const canImport =
    Boolean(preview) &&
    icalUrl.trim().length > 10 &&
    !previewing &&
    !importing;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent
        side="right"
        showCloseButton
        className={cn(
          "flex w-full flex-col gap-0 border-l border-border p-0",
          "sm:max-w-[440px]",
        )}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 text-left">
          <SheetTitle className="text-base font-semibold">
            Importar desde Airbnb
          </SheetTitle>
          <SheetDescription className="text-xs">
            Pega el enlace del anuncio y el iCal. PRAGMA creará la propiedad
            lista para reservas y calendario.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="airbnb-listing-url">Enlace del anuncio</Label>
              <Input
                id="airbnb-listing-url"
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                placeholder="https://www.airbnb.com/rooms/..."
                className="h-10"
                autoComplete="off"
              />
              {previewing ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Leyendo anuncio…
                </p>
              ) : null}
              {previewError ? (
                <p className="text-xs text-destructive">{previewError}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="airbnb-ical-url">Enlace iCal (calendario)</Label>
              <Input
                id="airbnb-ical-url"
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/....ics"
                className="h-10"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Lo guardamos para sincronizar reservas más adelante.
              </p>
            </div>

            {preview ? (
              <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                {preview.coverImageUrl ? (
                  <div className="relative aspect-[16/10] w-full bg-muted">
                    <Image
                      src={preview.coverImageUrl}
                      alt={preview.name}
                      fill
                      className="object-cover"
                      sizes="440px"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-muted text-xs text-muted-foreground">
                    Sin foto
                  </div>
                )}
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-sm font-semibold leading-snug">
                      {preview.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {preview.city}
                      {preview.neighborhood ? ` · ${preview.neighborhood}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {preview.maxGuests} huéspedes
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" />
                      {preview.bedrooms} hab. · {preview.beds} camas
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5" />
                      {preview.bathrooms} baños
                    </span>
                  </div>

                  {preview.description ? (
                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {preview.description}
                    </p>
                  ) : null}

                  <a
                    href={preview.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                  >
                    Ver en Airbnb
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-5 py-4">
          <Button
            type="button"
            disabled={!canImport}
            onClick={handleImport}
            className="h-11 w-full rounded-full bg-[#FF385C] text-white hover:bg-[#E31C5F]"
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando…
              </>
            ) : (
              "Importar propiedad"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
