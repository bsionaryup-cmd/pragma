"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AirbnbImportDrawer } from "@/features/properties/components/airbnb-import-drawer";
import { AirbnbHubActions } from "@/features/integrations/airbnb/components/airbnb-hub-actions";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyIdentity } from "@/components/properties/property-identity";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { formatDateTime } from "@/lib/helpers/date";

export type AirbnbIntegrationOverview = {
  linkedCount: number;
  lastSyncedAt: string | null;
  properties: Array<{
    id: string;
    name: string;
    unitNumber?: string | null;
    lastSyncedAt: string | null;
  }>;
};

type AirbnbIntegrationPanelProps = {
  overview: AirbnbIntegrationOverview;
  canSync: boolean;
};

export function AirbnbIntegrationPanel({
  overview,
  canSync,
}: AirbnbIntegrationPanelProps) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink href="/integrations" label="Integraciones" />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger/10">
              <Image
                src={BRAND_ASSETS.airbnbMark}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
                Integraciones
              </p>
              <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                Airbnb
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Importa listings, sincroniza calendarios iCal y publica bloqueos.
                La configuración por propiedad sigue en{" "}
                <Link href="/properties" className="font-medium text-primary hover:underline">
                  Propiedades
                </Link>
                .
              </p>
            </div>
          </div>
          <AirbnbHubActions
            canSync={canSync}
            onImportClick={() => setImportOpen(true)}
          />
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Propiedades vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{overview.linkedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Última sincronización
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {overview.lastSyncedAt
                  ? formatDateTime(overview.lastSyncedAt)
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calendarios iCal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Importa el enlace iCal de Airbnb al crear o editar una propiedad.
              PRAGMA exporta un calendario de vuelta para que Airbnb refleje
              bloqueos de reservas directas.
            </p>
            {overview.properties.length > 0 ? (
              <ul className="divide-y rounded-lg border border-border">
                {overview.properties.map((property) => (
                  <li
                    key={property.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <PropertyIdentity
                      name={property.name}
                      unitNumber={property.unitNumber}
                      size="sm"
                      className="min-w-[8rem] flex-1"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {property.lastSyncedAt
                          ? formatDateTime(property.lastSyncedAt)
                          : "Sin sync"}
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/properties?property=${property.id}`}>
                          Abrir
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
                {canSync
                  ? "Aún no hay propiedades con iCal de Airbnb. Usa «Importar desde Airbnb» para empezar."
                  : "No hay propiedades vinculadas."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AirbnbImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(property) => {
          setImportOpen(false);
          router.push(`/properties?property=${property.id}`);
        }}
      />
    </ModuleShellFlow>
  );
}
