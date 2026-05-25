"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeOnboardingAction } from "@/features/onboarding/actions/onboarding.actions";
import { applySalesOfferForCurrentUserAction } from "@/features/sales/actions/sales.actions";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

type OnboardingWizardProps = {
  displayName: string;
  email: string;
  offerToken?: string;
};

export function OnboardingWizard({
  displayName,
  email,
  offerToken,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState(displayName);
  const [phone, setPhone] = useState("");
  const [propertyCount, setPropertyCount] = useState("1");
  const [offerApplied, setOfferApplied] = useState(false);

  useEffect(() => {
    if (!offerToken || offerApplied) return;
    startTransition(async () => {
      const result = await applySalesOfferForCurrentUserAction(offerToken);
      if (result.success) {
        setOfferApplied(true);
        if (result.propertyCount) {
          setPropertyCount(String(result.propertyCount));
        }
        toast.success("Oferta privada aplicada a tu suscripción");
      } else {
        toast.error(result.error ?? "No se pudo aplicar la oferta");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerToken]);

  const onSubmitProfile = () => {
    const count = Number.parseInt(propertyCount, 10);
    startTransition(async () => {
      try {
        const result = await completeOnboardingAction({
          companyName,
          phone,
          propertyCount: count,
          offerToken,
        });
        if (result.ok) {
          toast.success(result.message);
          setStep(2);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
          Activa tu prueba
        </p>
        <h1 className="font-heading mt-2 text-2xl font-semibold">Configura tu trial</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {email} · Cuando termines, tendrás {SUBSCRIPTION_TRIAL_LABEL} para usar PRAGMA
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-2 w-8 rounded-full ${step >= n ? "bg-pragma-cyan" : "bg-muted"}`}
          />
        ))}
      </div>

      {step > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => setStep((current) => (current - 1) as 1 | 2 | 3)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Atrás
        </Button>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tu operación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Empresa o nombre del negocio</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <PhoneInput
                id="phone"
                value={phone}
                onChange={setPhone}
                disabled={pending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertyCount">Número de propiedades</Label>
              <Input
                id="propertyCount"
                type="number"
                min={1}
                value={propertyCount}
                onChange={(e) => setPropertyCount(e.target.value)}
                disabled={pending}
              />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={onSubmitProfile}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Primera propiedad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Agrega tu primera propiedad para ver calendario, reservas e ingresos.
            </p>
            <Button type="button" variant="outline" className="w-full" asChild>
              <Link href="/properties?create=true">Crear primera propiedad</Link>
            </Button>
            <Button
              type="button"
              className="w-full"
              onClick={() => setStep(3)}
            >
              Continuar sin crear ahora
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Listo para operar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Conecta calendarios iCal desde Propiedades y explora el panel operativo.
            </p>
            <ul className="space-y-2 rounded-xl border bg-muted/30 p-4 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-pragma-electric" />
                Sincroniza Airbnb vía iCal
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-pragma-electric" />
                Gestiona reservas desde el calendario
              </li>
            </ul>
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push("/panel")}
            >
              Ir al panel
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
