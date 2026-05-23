"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitLeadAction } from "@/features/leads/actions/lead.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";

type LeadCaptureFormProps = {
  source?: string;
  compact?: boolean;
};

export function LeadCaptureForm({ source = "landing", compact = false }: LeadCaptureFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyCount, setPropertyCount] = useState("1");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await submitLeadAction({
          fullName,
          email,
          phone: phone || undefined,
          propertyCount: Number.parseInt(propertyCount, 10) || undefined,
          message: message || undefined,
          source,
        });
        if (result.ok) {
          toast.success(result.message);
          setSubmitted(true);
        } else {
          toast.error(result.message);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al enviar");
      }
    });
  };

  if (submitted) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Gracias. Te contactaremos pronto. También puedes{" "}
        <Link href="/sign-up" className="font-medium underline">
          crear tu cuenta gratis
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className={compact ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
        <div className="space-y-2">
          <Label htmlFor="lead-name">Nombre completo</Label>
          <Input
            id="lead-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-email">Email</Label>
          <Input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-phone">Teléfono</Label>
          <PhoneInput
            id="lead-phone"
            value={phone}
            onChange={setPhone}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-properties">Propiedades</Label>
          <Input
            id="lead-properties"
            type="number"
            min={1}
            value={propertyCount}
            onChange={(e) => setPropertyCount(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      {!compact ? (
        <div className="space-y-2">
          <Label htmlFor="lead-message">Mensaje (opcional)</Label>
          <Textarea
            id="lead-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            disabled={pending}
          />
        </div>
      ) : null}
      <Button type="submit" variant="brand" disabled={pending} className="w-full sm:w-auto">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          "Solicitar información"
        )}
      </Button>
    </form>
  );
}
