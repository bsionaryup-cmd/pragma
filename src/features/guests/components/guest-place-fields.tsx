"use client";

import { useMemo, useState } from "react";
import {
  COLOMBIA_ADMIN_AREAS,
  ISO_COUNTRIES,
} from "@/lib/guest-registration/canonical-guest-catalogs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PlaceFields = {
  country: string;
  adminArea: string;
  city: string;
};

export function GuestPlaceFields({
  idPrefix,
  label,
  value,
  onChange,
}: {
  idPrefix: string;
  label: string;
  value: PlaceFields;
  onChange: (next: PlaceFields) => void;
}) {
  const [countryQuery, setCountryQuery] = useState("");
  const isColombia = value.country === "CO";

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return ISO_COUNTRIES;
    return ISO_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q),
    );
  }, [countryQuery]);

  return (
    <fieldset className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">{label}</legend>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-country-search`}>País</Label>
        <Input
          id={`${idPrefix}-country-search`}
          value={countryQuery}
          onChange={(e) => setCountryQuery(e.target.value)}
          placeholder="Buscar país…"
          autoComplete="off"
        />
        <select
          id={`${idPrefix}-country`}
          required
          value={value.country}
          onChange={(e) =>
            onChange({
              country: e.target.value,
              adminArea: e.target.value === "CO" ? value.adminArea : value.adminArea,
              city: value.city,
            })
          }
          className="h-10 w-full rounded-xl border border-input bg-white px-3.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-card"
        >
          <option value="">Selecciona…</option>
          {filteredCountries.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-admin`}>
            {isColombia ? "Departamento" : "Estado / provincia"}
          </Label>
          {isColombia ? (
            <select
              id={`${idPrefix}-admin`}
              required
              value={value.adminArea}
              onChange={(e) => onChange({ ...value, adminArea: e.target.value })}
              className="h-10 w-full rounded-xl border border-input bg-white px-3.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-card"
            >
              <option value="">Selecciona…</option>
              {COLOMBIA_ADMIN_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={`${idPrefix}-admin`}
              required
              value={value.adminArea}
              onChange={(e) => onChange({ ...value, adminArea: e.target.value })}
            />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>Ciudad</Label>
          <Input
            id={`${idPrefix}-city`}
            required
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            autoComplete="address-level2"
          />
        </div>
      </div>
    </fieldset>
  );
}
