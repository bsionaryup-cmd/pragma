"use client";

import Link from "next/link";
import type { StayPortalView } from "@/lib/guest-registration/stay-portal-access";
import { AccessCodeCard } from "./access-code-card";
import { ContactCard } from "./contact-card";
import { HouseRulesCard } from "./house-rules-card";
import { OpenDoorInstructions } from "./open-door-instructions";
import { QuickActionsCard } from "./quick-actions-card";
import { ReservationSummary } from "./reservation-summary";
import { StayPortalPropertyHeader } from "./stay-portal-property-header";
import { WifiCard } from "./wifi-card";

type StayPortalViewProps = {
  portal: StayPortalView;
};

function StayPortalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-pragma-soft">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export function StayPortalViewPanel({ portal }: StayPortalViewProps) {
  if (portal.state === "ended") {
    return (
      <StayPortalShell title="Estadía finalizada">
        {portal.propertyLabel ? (
          <p>{portal.propertyLabel}</p>
        ) : (
          <p>La información de acceso ya no está disponible.</p>
        )}
      </StayPortalShell>
    );
  }

  if (portal.state !== "active") {
    return (
      <StayPortalShell title="Portal no disponible">
        <p>
          Usa{" "}
          <Link href="/stay" className="font-medium text-foreground underline">
            /stay
          </Link>{" "}
          con tu código de reserva.
        </p>
      </StayPortalShell>
    );
  }

  const hasWifi = Boolean(portal.wifiName || portal.wifiPassword);

  return (
    <div className="space-y-4">
      <StayPortalPropertyHeader
        propertyLabel={portal.propertyLabel}
        unitNumber={portal.unitNumber}
        locationLabel={portal.locationLabel}
        addressLine={portal.addressLine}
        statusLabel={portal.statusLabel}
        coverImageUrl={portal.coverImageUrl}
      />

      <AccessCodeCard code={portal.accessCode} validTo={portal.accessValidTo} />

      <QuickActionsCard
        mapsUrl={portal.mapsUrl}
        whatsappUrl={portal.whatsappUrl}
        telUrl={portal.telUrl}
        hasWifi={hasWifi}
      />

      <WifiCard wifiName={portal.wifiName} wifiPassword={portal.wifiPassword} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <OpenDoorInstructions />
        <HouseRulesCard />
      </div>

      <ContactCard
        contactName={portal.contactName}
        whatsappUrl={portal.whatsappUrl}
        telUrl={portal.telUrl}
      />

      <ReservationSummary
        checkInLabel={portal.checkInLabel}
        checkOutLabel={portal.checkOutLabel}
        checkInTime={portal.checkInTime}
        checkOutTime={portal.checkOutTime}
        guestName={portal.guestName}
        reservationCode={portal.reservationCode}
      />

      <p className="px-2 pb-2 text-center text-xs text-muted-foreground">
        Tu seguridad es nuestra prioridad. Disfruta tu estancia.
      </p>
    </div>
  );
}
