import { Check, MapPin } from "lucide-react";

type StayPortalPropertyHeaderProps = {
  propertyLabel: string | null;
  unitNumber: string | null;
  locationLabel: string | null;
  addressLine: string | null;
  statusLabel: string | null;
  coverImageUrl: string | null;
};

export function StayPortalPropertyHeader({
  propertyLabel,
  unitNumber,
  locationLabel,
  addressLine,
  statusLabel,
  coverImageUrl,
}: StayPortalPropertyHeaderProps) {
  const title =
    unitNumber && propertyLabel && !propertyLabel.includes(unitNumber)
      ? `${unitNumber} — ${propertyLabel}`
      : propertyLabel;
  const location = locationLabel || addressLine;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-pragma-soft">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- guest portal uses arbitrary property URLs
          <img
            src={coverImageUrl}
            alt=""
            className="h-28 w-full shrink-0 rounded-xl object-cover sm:h-24 sm:w-32"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {location ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>{location}</span>
            </p>
          ) : null}
          {statusLabel ? (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
