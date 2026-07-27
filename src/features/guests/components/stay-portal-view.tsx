"use client";

import { Copy, Eye, EyeOff, ExternalLink, MapPin, Phone, Wifi } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { StayPortalView } from "@/lib/guest-registration/stay-portal-access";

type StayPortalViewProps = {
  portal: StayPortalView;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(`${label} copiado`);
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
    >
      <Copy className="mr-1.5 h-3.5 w-3.5" />
      Copiar
    </Button>
  );
}

function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function StayPortalViewPanel({ portal }: StayPortalViewProps) {
  const [codeVisible, setCodeVisible] = useState(false);

  if (portal.state === "ended") {
    return (
      <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
        <h1 className="text-2xl font-semibold tracking-tight">Estadía finalizada</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tu reserva
          {portal.propertyLabel ? ` en ${portal.propertyLabel}` : ""} ya terminó.
          La información de acceso ya no está disponible.
        </p>
      </section>
    );
  }

  if (portal.state !== "active") {
    return (
      <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
        <h1 className="text-2xl font-semibold tracking-tight">Portal no disponible</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          No encontramos una estadía activa para este enlace. Si acabas de
          registrarte, solicita el enlace a recepción o ingresa tu código de
          reserva en /stay.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-pragma-soft">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mi estadía
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {portal.propertyLabel}
        </h1>
        <dl className="mt-4 grid gap-2 text-sm">
          {portal.guestName ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Huésped</dt>
              <dd className="font-medium text-foreground">{portal.guestName}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Entrada</dt>
            <dd className="font-medium text-foreground">{portal.checkInLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Salida</dt>
            <dd className="font-medium text-foreground">{portal.checkOutLabel}</dd>
          </div>
          {portal.statusLabel ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="font-medium text-foreground">{portal.statusLabel}</dd>
            </div>
          ) : null}
          {portal.reservationCode ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Reserva</dt>
              <dd className="font-medium text-foreground">{portal.reservationCode}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <InfoBlock title="Código de acceso">
        {portal.accessCode ? (
          <>
            <p className="font-mono text-2xl tracking-widest text-foreground">
              {codeVisible ? portal.accessCode : "••••••••"}
            </p>
            {(portal.accessValidFrom || portal.accessValidTo) && (
              <p>
                Vigencia: {portal.accessValidFrom ?? "—"} →{" "}
                {portal.accessValidTo ?? "—"}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCodeVisible((v) => !v)}
              >
                {codeVisible ? (
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                )}
                {codeVisible ? "Ocultar" : "Mostrar"}
              </Button>
              <CopyButton value={portal.accessCode} label="Código" />
            </div>
          </>
        ) : (
          <p>El código de acceso se mostrará aquí cuando esté listo.</p>
        )}
      </InfoBlock>

      {portal.addressLine || portal.mapsUrl ? (
        <InfoBlock title="Dirección">
          {portal.addressLine ? <p className="text-foreground">{portal.addressLine}</p> : null}
          {portal.mapsUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={portal.mapsUrl} target="_blank" rel="noopener noreferrer">
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                Abrir en Google Maps
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
        </InfoBlock>
      ) : null}

      {(portal.wifiName || portal.wifiPassword) && (
        <InfoBlock title="WiFi">
          <div className="flex items-start gap-2">
            <Wifi className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {portal.wifiName ? (
                <p>
                  Red: <strong className="text-foreground">{portal.wifiName}</strong>
                </p>
              ) : null}
              {portal.wifiPassword ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p>
                    Contraseña:{" "}
                    <strong className="font-mono text-foreground">
                      {portal.wifiPassword}
                    </strong>
                  </p>
                  <CopyButton value={portal.wifiPassword} label="WiFi" />
                </div>
              ) : null}
            </div>
          </div>
        </InfoBlock>
      )}

      <InfoBlock title="Check-in / Check-out">
        <p>
          Check-in: <strong className="text-foreground">{portal.checkInTime}</strong>
          {portal.checkInLabel ? ` · ${portal.checkInLabel}` : null}
        </p>
        <p>
          Check-out:{" "}
          <strong className="text-foreground">{portal.checkOutTime}</strong>
          {portal.checkOutLabel ? ` · ${portal.checkOutLabel}` : null}
        </p>
        {portal.accessInstructions ? (
          <p className="whitespace-pre-wrap text-foreground">
            {portal.accessInstructions}
          </p>
        ) : null}
      </InfoBlock>

      {(portal.whatsappUrl || portal.telUrl) && (
        <InfoBlock title="Contacto">
          {portal.contactName ? (
            <p className="text-foreground">{portal.contactName}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {portal.whatsappUrl ? (
              <Button asChild size="sm">
                <a href={portal.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  WhatsApp Recepción
                </a>
              </Button>
            ) : null}
            {portal.telUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={portal.telUrl}>
                  <Phone className="mr-1.5 h-3.5 w-3.5" />
                  Llamar
                </a>
              </Button>
            ) : null}
          </div>
        </InfoBlock>
      )}

      {portal.houseRules ? (
        <InfoBlock title="Información importante">
          <p className="whitespace-pre-wrap text-foreground">{portal.houseRules}</p>
        </InfoBlock>
      ) : null}
    </div>
  );
}
