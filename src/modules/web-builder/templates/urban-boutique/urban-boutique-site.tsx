"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  Star,
  Users,
} from "lucide-react";
import { hostProfileHasContent } from "@/lib/web-builder/host-profile";
import type { PublicSitePayload } from "@/lib/web-builder/serialize-public-site";
import { URBAN_BOUTIQUE_HERO_EYEBROW } from "@/lib/web-builder/urban-boutique-defaults";
import { UrbaNovaMark } from "@/modules/web-builder/templates/urban-boutique/urba-nova-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type UrbanBoutiqueSiteProps = {
  site: PublicSitePayload;
  preview?: boolean;
};

function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

function siteLocale(site: PublicSitePayload) {
  return site.locale === "en" ? "en-US" : "es-CO";
}

function whatsAppHref(phone: string | null, siteName: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const text = encodeURIComponent(`Hola, me interesa reservar en ${siteName}`);
  return `https://wa.me/${digits}?text=${text}`;
}

type AvailabilityHit = {
  propertyId: string;
  name: string;
  unitNumber: string | null;
  maxGuests: number;
  quote: {
    nights: number;
    total: number;
    currency: string;
  };
};

const HERO_SUBLINE = "LOFTS AMOBLADOS · AIRBNB EN MEDELLÍN";
const LOCATION_BLURB =
  "Descubre Laureles, uno de los sectores más atractivos de Medellín, con una excelente oferta gastronómica, comercial y cultural.";
const LOFTS_SUBTITLE = "Espacios diseñados para disfrutar Medellín.";

export function UrbanBoutiqueSite({ site, preview }: UrbanBoutiqueSiteProps) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailabilityHit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);

  const listings = useMemo(() => site.listings.slice(0, 4), [site.listings]);
  const selected = available.find((row) => row.propertyId === selectedPropertyId);
  const wa = whatsAppHref(site.whatsapp, site.siteName);
  const heroTitle =
    site.heroTitle?.trim() ||
    "Tu hogar fuera de casa en Laureles, Medellín";
  const useUrbaMark = /urba|nova|loft\s*33/i.test(site.siteName);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!site.bookingEnabled) return;
    setSearching(true);
    setSearchError(null);
    setBookingMessage(null);
    setAvailable([]);
    setSelectedPropertyId(null);
    setAcceptedPolicies(false);
    try {
      const res = await fetch("/api/web-builder/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: site.slug,
          checkIn,
          checkOut,
          guests: Number(guests),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        available?: AvailabilityHit[];
      };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? "No hay disponibilidad");
      }
      const hits = json.available ?? [];
      setAvailable(hits);
      if (!hits.length) {
        setSearchError("Sin disponibilidad para estas fechas.");
      } else {
        setSelectedPropertyId(hits[0]!.propertyId);
        document.getElementById("resultado-busqueda")?.scrollIntoView({
          behavior: "smooth",
        });
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setSearching(false);
    }
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !site.bookingEnabled || !acceptedPolicies) return;
    setBooking(true);
    setBookingMessage(null);
    try {
      const res = await fetch("/api/web-builder/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: site.slug,
          propertyId: selected.propertyId,
          checkIn,
          checkOut,
          adults: Number(guests),
          children: 0,
          infants: 0,
          guestFirstName,
          guestLastName,
          guestEmail: guestEmail || null,
          guestPhone: guestPhone || null,
          totalAmount: selected.quote.total,
          policiesAccepted: true as const,
          idempotencyKey:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `web-${Date.now()}`,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: {
          reservationId?: string;
          reservationCode?: string | null;
          guestRegistrationUrl?: string | null;
          paymentHold?: {
            paymentRequired?: boolean;
            checkoutUrl?: string | null;
            reason?: string;
          };
        };
      };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? "No se pudo crear la reserva");
      }
      const hold = json.data?.paymentHold;
      const code = json.data?.reservationCode?.trim();
      const registrationUrl = json.data?.guestRegistrationUrl?.trim();

      if (hold?.paymentRequired && hold.checkoutUrl) {
        window.open(hold.checkoutUrl, "_blank", "noopener,noreferrer");
      }

      // Web channel: redirect straight to guest registration (no email/WhatsApp).
      if (registrationUrl) {
        setBookingMessage(
          code
            ? `Reserva ${code} creada. Te llevamos al registro de huéspedes…`
            : "Reserva creada. Te llevamos al registro de huéspedes…",
        );
        window.location.assign(registrationUrl);
        return;
      }

      if (hold?.paymentRequired) {
        setBookingMessage(
          `Reserva creada${code ? ` (${code})` : ""}. ${
            hold.reason ??
            "Pago pendiente: el equipo te contactará con el enlace de pago."
          }`,
        );
      } else {
        setBookingMessage(
          `Reserva creada${code ? `: ${code}` : `. Referencia ${json.data?.reservationId ?? ""}`}.`,
        );
      }
      setAvailable([]);
      setSelectedPropertyId(null);
      setAcceptedPolicies(false);
    } catch (err) {
      setBookingMessage(err instanceof Error ? err.message : "Error al reservar");
    } finally {
      setBooking(false);
    }
  }

  const navLinks = (
    <>
      <a href="#lofts" className="tracking-[0.14em] hover:text-[var(--wb-accent)]">
        LOFTS
      </a>
      <a
        href="#ubicacion"
        className="tracking-[0.14em] hover:text-[var(--wb-accent)]"
      >
        UBICACIÓN
      </a>
      <a
        href="#contacto"
        className="tracking-[0.14em] hover:text-[var(--wb-accent)]"
      >
        CONTACTO
      </a>
    </>
  );

  return (
    <div className="min-h-dvh bg-[var(--wb-soft-white)] font-[family-name:var(--wb-font-body)] text-[var(--wb-matte-black)]">
      {preview ? (
        <div className="border-b border-[var(--wb-sand-oak)] bg-[var(--wb-sand-oak)]/30 px-4 py-2 text-center text-xs tracking-wide text-[var(--wb-urban-gray)]">
          Vista previa · estado {site.status}
        </div>
      ) : null}

      <header className="sticky top-0 z-30 bg-[var(--wb-soft-white)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8 md:py-5">
          <a href="#reservar" className="min-w-0" aria-label={site.siteName}>
            {site.logoUrl && !useUrbaMark ? (
              <div className="flex items-center gap-2.5">
                <Image
                  src={site.logoUrl}
                  alt={site.siteName}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                  unoptimized
                />
                <span className="truncate text-[11px] font-medium uppercase tracking-[0.18em] md:text-xs">
                  {site.siteName}
                </span>
              </div>
            ) : (
              <UrbaNovaMark variant="horizontal" />
            )}
          </a>

          <details className="group relative md:hidden">
            <summary className="cursor-pointer list-none rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] [&::-webkit-details-marker]:hidden">
              Menú
            </summary>
            <nav className="absolute right-0 top-full z-40 mt-2 flex min-w-[11rem] flex-col gap-3 rounded-2xl border border-black/8 bg-[var(--wb-soft-white)] p-4 text-xs shadow-lg">
              {navLinks}
              <a
                href="#reservar"
                className="inline-flex items-center gap-2 font-semibold text-[var(--wb-accent)]"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                RESERVAR
              </a>
            </nav>
          </details>

          <nav className="hidden items-center gap-10 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--wb-matte-black)] md:flex">
            {navLinks}
          </nav>

          <div className="hidden md:block">
            <Button
              asChild
              className="rounded-full bg-[var(--wb-accent)] px-5 text-[11px] font-semibold tracking-[0.14em] text-[var(--wb-soft-white)] transition hover:bg-[var(--wb-accent)]/90"
            >
              <a href="#reservar" className="inline-flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                RESERVAR
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative px-4 pb-6 pt-2 md:px-8 md:pb-8 md:pt-3">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[1.5rem] bg-[var(--wb-matte-black)] shadow-[0_20px_60px_rgba(31,31,31,0.12)] md:rounded-[1.75rem]">
          <div className="relative aspect-[16/11] w-full min-h-[22rem] sm:min-h-[26rem] md:aspect-[21/10] md:min-h-[28rem]">
            {site.heroImageUrl ? (
              <Image
                src={site.heroImageUrl}
                alt={heroTitle}
                fill
                className="object-cover object-center"
                priority
                sizes="(max-width: 768px) 100vw, 1152px"
                unoptimized
              />
            ) : (
              <div className="flex h-full min-h-[22rem] items-center justify-center border border-dashed border-white/20 bg-[var(--wb-stone-taupe)]/40 px-6 text-center text-sm text-white/80">
                Fotografía pendiente de carga autorizada
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

            <div className="absolute inset-x-0 top-0 flex h-full flex-col justify-center px-6 pb-24 pt-10 md:px-12 md:pb-28 lg:px-16">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/95 md:text-[11px]">
                {URBAN_BOUTIQUE_HERO_EYEBROW}
              </p>
              <div className="mt-2.5 h-px w-14 bg-white/85" />
              <h1 className="mt-5 max-w-2xl font-[family-name:var(--wb-font-display)] text-[1.85rem] font-medium leading-[1.18] tracking-[-0.01em] text-white md:text-4xl lg:text-[2.65rem]">
                {heroTitle}
              </h1>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/90 md:text-[11px]">
                {site.heroSubtitle?.includes("AIRBNB") ||
                site.heroSubtitle?.includes("DISEÑO")
                  ? site.heroSubtitle
                  : HERO_SUBLINE}
              </p>
            </div>
          </div>
        </div>

        <BookingPill
          id="reservar"
          onSubmit={handleSearch}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          onCheckIn={setCheckIn}
          onCheckOut={setCheckOut}
          onGuests={setGuests}
          disabled={!site.bookingEnabled}
          loading={searching}
          error={searchError}
        />
      </section>

      <main>
        {available.length > 0 ? (
          <section
            id="resultado-busqueda"
            className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 md:px-8"
          >
            <h2 className="mb-4 font-[family-name:var(--wb-font-display)] text-3xl">
              Disponibles para tus fechas
            </h2>
            <ul className="space-y-3">
              {available.map((hit) => (
                <li key={hit.propertyId}>
                  <button
                    type="button"
                    onClick={() => setSelectedPropertyId(hit.propertyId)}
                    className={cn(
                      "flex w-full flex-col items-start justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm transition sm:flex-row sm:items-center",
                      selectedPropertyId === hit.propertyId
                        ? "border-[var(--wb-accent)] bg-[var(--wb-sand-oak)]/20"
                        : "border-[var(--wb-sand-oak)]/40 hover:border-[var(--wb-sand-oak)]",
                    )}
                  >
                    <span>
                      {hit.name}
                      {hit.unitNumber ? ` · ${hit.unitNumber}` : ""}
                      <span className="mt-1 block text-xs text-[var(--wb-urban-gray)]">
                        Hasta {hit.maxGuests} huéspedes
                      </span>
                    </span>
                    <span className="font-medium">
                      {formatMoney(
                        hit.quote.total,
                        hit.quote.currency,
                        siteLocale(site),
                      )}{" "}
                      · {hit.quote.nights}{" "}
                      {hit.quote.nights === 1 ? "noche" : "noches"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selected ? (
              <form
                onSubmit={handleBook}
                className="mt-6 grid gap-3 rounded-2xl border border-[var(--wb-sand-oak)]/40 bg-white p-5 md:grid-cols-2"
              >
                <div>
                  <Label htmlFor="wb-first">Nombre</Label>
                  <Input
                    id="wb-first"
                    required
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="wb-last">Apellido</Label>
                  <Input
                    id="wb-last"
                    required
                    value={guestLastName}
                    onChange={(e) => setGuestLastName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="wb-email">Email</Label>
                  <Input
                    id="wb-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="wb-phone">Teléfono</Label>
                  <Input
                    id="wb-phone"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <PoliciesCheckbox
                  id="wb-policies"
                  checked={acceptedPolicies}
                  onChecked={setAcceptedPolicies}
                  className="md:col-span-2"
                />
                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    disabled={booking || !acceptedPolicies}
                    className="w-full rounded-full bg-[var(--wb-accent)] text-[var(--wb-soft-white)] hover:bg-[var(--wb-accent)]/90 sm:w-auto"
                  >
                    {booking ? "Procesando…" : "Confirmar reserva"}
                  </Button>
                </div>
              </form>
            ) : null}
          </section>
        ) : null}

        {bookingMessage ? (
          <p className="mx-auto mb-4 max-w-3xl px-4 text-center text-sm text-[var(--wb-urban-gray)] md:px-8">
            {bookingMessage}
          </p>
        ) : null}

        <section
          id="lofts"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:px-8 md:py-20"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--wb-accent)]">
                NUESTROS LOFTS
              </p>
              <h2 className="mt-2 max-w-xl font-[family-name:var(--wb-font-display)] text-2xl font-medium leading-tight tracking-tight md:text-3xl lg:text-[2.15rem]">
                ALOJAMIENTO TURÍSTICO EN MEDELLÍN
              </h2>
              <p className="mt-2 max-w-md text-sm text-[var(--wb-urban-gray)]">
                {LOFTS_SUBTITLE}
              </p>
            </div>
            <a
              href="#reservar"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--wb-matte-black)] hover:text-[var(--wb-accent)]"
            >
              VER TODOS
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {listings.map((item) => {
              const label =
                item.unitNumber != null
                  ? `LOFT ${item.unitNumber}`
                  : item.name.toUpperCase();
              return (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-[1.15rem] bg-[var(--wb-sand-oak)]/35 shadow-[0_8px_24px_rgba(31,31,31,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(31,31,31,0.08)] motion-reduce:transform-none"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-t-[1.15rem] bg-[var(--wb-sand-oak)]/40">
                    {item.coverImageUrl ? (
                      <Image
                        src={item.coverImageUrl}
                        alt={item.name}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--wb-urban-gray)]">
                        Fotografía pendiente de carga autorizada
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-[var(--wb-soft-white)] px-4 py-3.5">
                    <div className="min-w-0">
                      <h3 className="truncate font-[family-name:var(--wb-font-display)] text-base font-medium tracking-[0.04em] md:text-lg">
                        {label}
                      </h3>
                      <p className="text-[11px] text-[var(--wb-urban-gray)]">
                        Hasta {item.maxGuests} huéspedes
                        {item.baseRate > 0
                          ? ` · Desde ${formatMoney(
                              item.baseRate,
                              item.currency || site.currency,
                              siteLocale(site),
                            )}`
                          : ""}
                      </p>
                    </div>
                    <a
                      href="#reservar"
                      aria-label={`Ver detalles ${label}`}
                      title="VER DETALLES"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wb-accent)] text-[var(--wb-soft-white)] transition hover:bg-[var(--wb-accent)]/90"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <HostSection site={site} />

        <section id="ubicacion" className="scroll-mt-24 px-4 py-6 md:px-8 md:py-10">
          <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[1.5rem] md:grid-cols-2">
            <div className="flex flex-col justify-center bg-[var(--wb-soft-white)] px-6 py-12 md:px-10 lg:px-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--wb-accent)]">
                UNA UBICACIÓN PRIVILEGIADA
              </p>
              <h2 className="mt-3 font-[family-name:var(--wb-font-display)] text-3xl font-medium leading-tight tracking-tight md:text-4xl lg:text-5xl">
                {[site.locationNeighborhood, site.locationCity]
                  .filter(Boolean)
                  .join(", ")
                  .toUpperCase() || "LAURELES, MEDELLÍN"}
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--wb-urban-gray)] md:text-base">
                {site.locationDescription?.trim() || LOCATION_BLURB}
              </p>
              {site.locationMapUrl ? (
                <Button
                  asChild
                  variant="outline"
                  className="mt-8 w-fit rounded-full border-[var(--wb-matte-black)]/15 bg-transparent px-5 text-[11px] font-semibold tracking-[0.14em] hover:bg-black/[0.03]"
                >
                  <a
                    href={site.locationMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    VER EN EL MAPA
                  </a>
                </Button>
              ) : null}
            </div>
            <div
              className="relative min-h-[16rem] overflow-hidden md:min-h-[22rem]"
              style={{
                clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0 100%)",
              }}
            >
              {site.locationImageUrl ? (
                <Image
                  src={site.locationImageUrl}
                  alt="Laureles, Medellín"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              ) : (
                <div className="flex h-full min-h-[16rem] items-center justify-center bg-[var(--wb-stone-taupe)]/30 px-6 text-center text-sm text-[var(--wb-urban-gray)]">
                  Imagen panorámica pendiente de carga autorizada
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          id="contacto"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:px-8"
        >
          <h2 className="font-[family-name:var(--wb-font-display)] text-3xl">
            CONTACTO
          </h2>
          <p className="mt-3 max-w-xl text-sm text-[var(--wb-urban-gray)]">
            Escríbenos para reservas, estadías prolongadas o preguntas sobre
            nuestras unidades en Laureles.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            {site.contactEmail ? (
              <a
                href={`mailto:${site.contactEmail}`}
                className="text-[var(--wb-accent)] hover:underline"
              >
                {site.contactEmail}
              </a>
            ) : null}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--wb-accent)] hover:underline"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="bg-[color-mix(in_srgb,var(--wb-accent)_55%,#1F1F1F)] px-4 py-14 text-center text-[var(--wb-soft-white)] md:px-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
          {useUrbaMark ? (
            <UrbaNovaMark variant="stacked" inverted />
          ) : (
            <UrbaNovaMark variant="horizontal" inverted />
          )}
          <p className="text-xs text-white/75">
            © 2026 {site.siteName}. Lofts amoblados en Laureles, Medellín.
          </p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">
            Alojamiento turístico · Airbnb en Medellín · Reservas directas
          </p>
          <div className="mt-2 flex items-center gap-5 text-xs text-white/80">
            {site.instagramUrl ? (
              <a
                href={site.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-white"
              >
                Instagram
              </a>
            ) : null}
            {site.facebookUrl ? (
              <a
                href={site.facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-white"
              >
                Facebook
              </a>
            ) : null}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-white"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </footer>

      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white/70"
          aria-label="Contactar por WhatsApp"
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
            <path
              fill="currentColor"
              d="M16.1 5C10.6 5 6.1 9.5 6.1 15c0 1.8.5 3.5 1.4 5L6 27l7.2-1.9c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S21.6 5 16.1 5zm5.8 14.2c-.2.7-1.3 1.3-2.1 1.4-.5.1-1.2.1-1.9-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.8-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.7 2 .8 2.1.1.2.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.3-.5.5-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.3 2.5 1.5.3.1.5.1.7-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.7-.1.3.1 1.9.9 2.2 1.1.3.2.5.2.6.4.1.2.1.9-.1 1.6z"
            />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

type BookingPillProps = {
  id: string;
  onSubmit: (e: React.FormEvent) => void;
  checkIn: string;
  checkOut: string;
  guests: string;
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  onGuests: (v: string) => void;
  disabled: boolean;
  loading: boolean;
  error: string | null;
};

/**
 * Editorial host block. Renders only with real content:
 * - full host profile when any host field is present
 * - minimal "about" block when only aboutText exists
 * - nothing otherwise
 */
function HostSection({ site }: { site: PublicSitePayload }) {
  const host = site.hostProfile;
  const about = site.aboutText?.trim() || null;
  const hasHost = hostProfileHasContent(host);

  if (!hasHost && !about) return null;

  const eyebrow = hasHost ? "TU ANFITRIÓN" : "SOBRE NOSOTROS";
  const heading = host?.hostName?.trim() || site.siteName;
  const body = host?.hostBio?.trim() || about;
  const rating = host?.hostRating ?? null;
  const reviewCount = host?.hostReviewCount ?? null;
  const testimonials = host?.hostTestimonials ?? [];
  const showAboutExtra = Boolean(host?.hostBio?.trim() && about);

  return (
    <section
      id="anfitrion"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 md:px-8 md:py-16"
    >
      <div
        className={cn(
          "grid items-center gap-8 md:gap-12",
          host?.hostPhotoUrl ? "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : "",
        )}
      >
        {host?.hostPhotoUrl ? (
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[1.5rem] bg-[var(--wb-sand-oak)]/40 md:max-w-none">
            <Image
              src={host.hostPhotoUrl}
              alt={host.hostName ? `Anfitrión ${host.hostName}` : "Anfitrión"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 40vw"
              unoptimized
            />
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--wb-accent)]">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-[family-name:var(--wb-font-display)] text-3xl font-medium leading-tight tracking-tight md:text-4xl">
            {heading}
          </h2>

          {rating != null || reviewCount != null ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--wb-urban-gray)]">
              {rating != null ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--wb-matte-black)]">
                  <Star
                    className="h-4 w-4 fill-[var(--wb-accent)] text-[var(--wb-accent)]"
                    aria-hidden
                  />
                  {rating.toFixed(2).replace(/\.?0+$/, "")}
                </span>
              ) : null}
              {reviewCount != null ? (
                <span>
                  {reviewCount} {reviewCount === 1 ? "reseña" : "reseñas"}
                </span>
              ) : null}
            </p>
          ) : null}

          {body ? (
            <p className="mt-5 max-w-xl whitespace-pre-line text-sm leading-relaxed text-[var(--wb-urban-gray)] md:text-base">
              {body}
            </p>
          ) : null}

          {showAboutExtra ? (
            <p className="mt-4 max-w-xl whitespace-pre-line text-sm leading-relaxed text-[var(--wb-urban-gray)]">
              {about}
            </p>
          ) : null}

          {host?.hostExperience ? (
            <p className="mt-5 max-w-xl border-l-2 border-[var(--wb-accent)] pl-4 text-sm font-medium text-[var(--wb-matte-black)]">
              {host.hostExperience}
            </p>
          ) : null}
        </div>
      </div>

      {testimonials.length > 0 ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <figure
              key={`${item.guestName}-${index}`}
              className="rounded-[1.15rem] bg-[var(--wb-sand-oak)]/30 p-5 md:p-6"
            >
              <blockquote className="text-sm leading-relaxed text-[var(--wb-matte-black)]">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--wb-urban-gray)]">
                {item.guestName}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BookingPill(props: BookingPillProps) {
  const {
    id,
    onSubmit,
    checkIn,
    checkOut,
    guests,
    onCheckIn,
    onCheckOut,
    onGuests,
    disabled,
    loading,
    error,
  } = props;
  // Avoid SSR/client date-input locale placeholder mismatches
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div
      id={id}
      className="relative z-10 mx-auto -mt-9 max-w-4xl scroll-mt-24 px-2 sm:-mt-11 md:px-0"
    >
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 rounded-[1.35rem] border border-black/[0.04] bg-white/95 p-2.5 shadow-[0_16px_40px_rgba(31,31,31,0.12)] backdrop-blur md:flex-row md:items-stretch md:gap-0 md:rounded-full md:p-1.5 md:pl-4"
      >
        <PillField label="Llegada" icon={<CalendarDays className="h-3.5 w-3.5" />}>
          {ready ? (
            <label className="relative block cursor-pointer">
              {!checkIn ? (
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-sm text-[var(--wb-urban-gray)]">
                  Selecciona fecha
                </span>
              ) : null}
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => onCheckIn(e.target.value)}
                required
                aria-label="Fecha de llegada"
                className={cn(
                  "h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
                  !checkIn && "text-transparent",
                )}
              />
            </label>
          ) : (
            <div className="h-8 text-sm text-[var(--wb-urban-gray)]">
              Selecciona fecha
            </div>
          )}
        </PillField>
        <div className="hidden w-px self-stretch bg-black/10 md:block" />
        <PillField label="Salida" icon={<CalendarDays className="h-3.5 w-3.5" />}>
          {ready ? (
            <label className="relative block cursor-pointer">
              {!checkOut ? (
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-sm text-[var(--wb-urban-gray)]">
                  Selecciona fecha
                </span>
              ) : null}
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => onCheckOut(e.target.value)}
                required
                aria-label="Fecha de salida"
                className={cn(
                  "h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
                  !checkOut && "text-transparent",
                )}
              />
            </label>
          ) : (
            <div className="h-8 text-sm text-[var(--wb-urban-gray)]">
              Selecciona fecha
            </div>
          )}
        </PillField>
        <div className="hidden w-px self-stretch bg-black/10 md:block" />
        <PillField label="Huéspedes" icon={<Users className="h-3.5 w-3.5" />}>
          <Input
            type="number"
            min={1}
            max={30}
            value={guests}
            onChange={(e) => onGuests(e.target.value)}
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </PillField>
        <Button
          type="submit"
          disabled={disabled || loading}
          className="h-11 shrink-0 rounded-full bg-[var(--wb-accent)] px-5 text-[11px] font-semibold tracking-[0.14em] text-[var(--wb-soft-white)] transition hover:bg-[var(--wb-accent)]/90 md:h-12 md:min-w-[7.5rem]"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            {loading ? "…" : "BUSCAR"}
          </span>
        </Button>
      </form>
      {error ? (
        <p className="mt-3 text-center text-xs text-red-700">{error}</p>
      ) : null}
      {disabled ? (
        <p className="mt-3 text-center text-xs text-[var(--wb-urban-gray)]">
          Reservas web desactivadas para este sitio.
        </p>
      ) : null}
    </div>
  );
}

function PillField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 px-2 py-1">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--wb-urban-gray)]">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function PoliciesCheckbox({
  id,
  checked,
  onChecked,
  className,
}: {
  id: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChecked(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--wb-accent)]"
      />
      <Label
        htmlFor={id}
        className="text-xs leading-snug text-[var(--wb-urban-gray)]"
      >
        Acepto políticas de alojamiento y tratamiento de datos
      </Label>
    </div>
  );
}
