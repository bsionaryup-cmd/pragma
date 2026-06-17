"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getQuickMessagesSettingsAction,
  saveQuickMessagesSettingsAction,
} from "@/features/settings/actions/quick-messages.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  QUICK_MESSAGE_TEMPLATE_HINT,
  QUICK_MESSAGE_TYPES,
  quickMessageButtonLabel,
  quickMessageFormFieldName,
} from "@/lib/reservations/quick-message-templates";
import {
  getDefaultQuickMessageTemplate,
  type QuickMessageType,
} from "@/lib/reservations/quick-messages";

type QuickMessagesSettingsProps = {
  canManage: boolean;
};

type FormState = Record<`quickMessage${QuickMessageType}`, string>;

const emptyForm = (): FormState =>
  Object.fromEntries(
    QUICK_MESSAGE_TYPES.map((type) => [quickMessageFormFieldName(type), ""]),
  ) as FormState;

export function QuickMessagesSettings({ canManage }: QuickMessagesSettingsProps) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const result = await getQuickMessagesSettingsAction();
      if (result.success) {
        setForm({ ...emptyForm(), ...result.fields });
      }
      setLoaded(true);
    });
  }, []);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function restoreDefault(type: QuickMessageType) {
    updateField(quickMessageFormFieldName(type), getDefaultQuickMessageTemplate(type));
  }

  function save() {
    startTransition(async () => {
      const result = await saveQuickMessagesSettingsAction(form);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setForm({ ...emptyForm(), ...result.fields });
      toast.success("Mensajes rápidos guardados");
    });
  }

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Cargando mensajes…</p>;
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Solo administradores pueden editar los mensajes rápidos.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Plantillas oficiales de PRAGMA para copiar y pegar al huésped en Airbnb u
        otros canales. Los datos de cada reserva se rellenan al copiar.
      </p>
      <p className="text-xs text-muted-foreground">{QUICK_MESSAGE_TEMPLATE_HINT}</p>

      {QUICK_MESSAGE_TYPES.map((type) => {
        const fieldName = quickMessageFormFieldName(type);
        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={fieldName}>{quickMessageButtonLabel(type)}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => restoreDefault(type)}
              >
                Restaurar predeterminado
              </Button>
            </div>
            <Textarea
              id={fieldName}
              rows={5}
              value={form[fieldName]}
              placeholder={getDefaultQuickMessageTemplate(type)}
              onChange={(e) => updateField(fieldName, e.target.value)}
            />
          </div>
        );
      })}

      <Button type="button" disabled={pending} onClick={save}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando…
          </>
        ) : (
          "Guardar mensajes"
        )}
      </Button>
    </div>
  );
}
