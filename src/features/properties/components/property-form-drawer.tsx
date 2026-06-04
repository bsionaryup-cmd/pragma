"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/features/properties/actions/property.actions";
import {
  propertyFormSchema,
  type PropertyFormValues,
} from "@/features/properties/schemas/property.schema";
import type {
  PropertyDetailDto,
  PropertyGridItem,
} from "@/features/properties/types/property.types";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PropertyStatus, PropertyType } from "@prisma/client";
import { propertyStatusLabels, propertyTypeLabels } from "@/lib/labels";
import { getDefaultQuickMessageTemplate } from "@/lib/reservations/quick-messages";
import {
  QUICK_MESSAGE_TEMPLATE_HINT,
  QUICK_MESSAGE_TYPES,
  quickMessageFieldLabel,
  quickMessageFormFieldName,
} from "@/lib/reservations/quick-message-templates";

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function detailToFormValues(property: PropertyDetailDto): PropertyFormValues {
  return {
    name: property.name,
    unitNumber: property.unitNumber ?? "",
    description: property.description ?? "",
    propertyType: property.propertyType,
    maxGuests: property.maxGuests,
    bedrooms: property.bedrooms,
    beds: property.beds,
    bathrooms: Number(property.bathrooms),
    country: property.country,
    city: property.city,
    address: property.address,
    neighborhood: property.neighborhood ?? "",
    checkInTime: property.checkInTime ?? "15:00",
    checkOutTime: property.checkOutTime ?? "13:00",
    accessCode: property.accessCode ?? "",
    accessInstructions: property.accessInstructions ?? "",
    wifiName: property.wifiName ?? "",
    wifiPassword: property.wifiPassword ?? "",
    houseRules: property.houseRules ?? "",
    baseRate: property.baseRate ? Number(property.baseRate) : undefined,
    cleaningFee: property.cleaningFee ? Number(property.cleaningFee) : undefined,
    coverImageUrl: property.coverImageUrl ?? "",
    status: property.status,
    notificationEmails: property.notificationEmails ?? "",
    receptionWhatsapp: property.receptionWhatsapp ?? "",
    useDefaultQuickMessages: property.useDefaultQuickMessages ?? true,
    quickMessageWELCOME: property.quickMessageWELCOME ?? "",
    quickMessageREGISTRATION: property.quickMessageREGISTRATION ?? "",
    quickMessageACCESS: property.quickMessageACCESS ?? "",
    quickMessageFOLLOW_UP: property.quickMessageFOLLOW_UP ?? "",
    quickMessageCHECKOUT: property.quickMessageCHECKOUT ?? "",
  };
}

const defaultCreateValues: PropertyFormValues = {
  name: "",
  unitNumber: "",
  description: "",
  propertyType: PropertyType.APARTMENT,
  maxGuests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  country: "CO",
  city: "",
  address: "",
  neighborhood: "",
  checkInTime: "15:00",
  checkOutTime: "13:00",
  accessCode: "",
  accessInstructions: "",
  wifiName: "",
  wifiPassword: "",
  houseRules: "",
  baseRate: undefined,
  cleaningFee: undefined,
  coverImageUrl: "",
  status: PropertyStatus.ACTIVE,
  notificationEmails: "",
  receptionWhatsapp: "",
  useDefaultQuickMessages: true,
  quickMessageWELCOME: "",
  quickMessageREGISTRATION: "",
  quickMessageACCESS: "",
  quickMessageFOLLOW_UP: "",
  quickMessageCHECKOUT: "",
};

type PropertyFormDrawerProps = {
  mode: "create" | "edit";
  property?: PropertyDetailDto | null;
  onSuccess: (property: PropertyGridItem | PropertyDetailDto) => void;
  onCancel: () => void;
};

export function PropertyFormDrawer({
  mode,
  property,
  onSuccess,
  onCancel,
}: PropertyFormDrawerProps) {
  const isEditing = mode === "edit" && Boolean(property);

  const [showCustomizeMessages, setShowCustomizeMessages] = useState(
    () => (property ? !property.useDefaultQuickMessages : false),
  );

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: defaultCreateValues,
  });

  const useDefaultQuickMessages = form.watch("useDefaultQuickMessages");

  useEffect(() => {
    if (isEditing && property) {
      form.reset(detailToFormValues(property));
      setShowCustomizeMessages(!property.useDefaultQuickMessages);
    } else if (mode === "create") {
      form.reset(defaultCreateValues);
      setShowCustomizeMessages(false);
    }
  }, [form, isEditing, mode, property]);

  async function onSubmit(values: PropertyFormValues) {
    try {
      if (isEditing && property) {
        const result = await updatePropertyAction(property.id, values);
        if (!result.success) {
          toast.error("message" in result ? result.message : "No se pudo actualizar");
          return;
        }
        toast.success("Propiedad actualizada");
        onSuccess(result.property);
      } else {
        const result = await createPropertyAction(values);
        if (!result.success) {
          toast.error("message" in result ? result.message : "No se pudo crear");
          return;
        }
        toast.success("Propiedad creada");
        onSuccess(result.property);
      }
    } catch {
      toast.error("No se pudo guardar la propiedad");
    }
  }

  const pending = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex h-full flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <FormSection title="Información general">
            <FormField
              control={form.control}
              name="unitNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de apartamento / unidad</FormLabel>
                  <FormControl>
                    <Input placeholder="302, 801, Loft A…" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Identificador principal en calendario, reservas e integraciones.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre en Airbnb / listing</FormLabel>
                  <FormControl>
                    <Input placeholder="Loft 2P con vista premium…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción corta</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(PropertyType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {propertyTypeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxGuests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Huéspedes máx.</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 1)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Máximo de huéspedes al crear o editar reservas en esta propiedad.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Habitaciones</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="beds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baños</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="coverImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL foto portada</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <FormSection title="Ubicación">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País</FormLabel>
                    <FormControl>
                      <Input placeholder="CO" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input placeholder="Bogotá" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="neighborhood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Barrio</FormLabel>
                  <FormControl>
                    <Input placeholder="Chapinero" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <FormSection title="Mensajes al huésped">
            <p className="text-xs text-muted-foreground">
              Configura la propiedad una vez y PRAGMA arma los mensajes para copiar en
              reservas. Usa la dirección con calle y número (no solo la ciudad).
            </p>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección en mensajes</FormLabel>
                  <FormControl>
                    <Input placeholder="Av 33 #80-25" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="checkInTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-in</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkOutTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-out</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="receptionWhatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp recepción</FormLabel>
                  <FormControl>
                    <Input placeholder="+57 300 123 4567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Número para que el huésped escriba a recepción (variable{" "}
                    {"{receptionWhatsapp}"}).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="wifiName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WiFi (red)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="wifiPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WiFi (clave)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="accessCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de acceso</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="useDefaultQuickMessages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-xl border border-border/80 bg-muted/20 p-3">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-input"
                      checked={field.value ?? true}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        field.onChange(checked);
                        if (checked) {
                          setShowCustomizeMessages(false);
                          for (const type of QUICK_MESSAGE_TYPES) {
                            form.setValue(quickMessageFormFieldName(type), "");
                          }
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-medium">
                      Usar mensajes predeterminados de PRAGMA (recomendado)
                    </FormLabel>
                    <FormDescription>
                      Los mensajes utilizarán automáticamente los datos configurados en
                      esta propiedad.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {useDefaultQuickMessages || !showCustomizeMessages ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  form.setValue("useDefaultQuickMessages", false);
                  setShowCustomizeMessages(true);
                }}
              >
                Personalizar mensajes
              </Button>
            ) : null}
            {showCustomizeMessages && !useDefaultQuickMessages ? (
              <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">{QUICK_MESSAGE_TEMPLATE_HINT}</p>
                {QUICK_MESSAGE_TYPES.map((type) => (
                  <FormField
                    key={type}
                    control={form.control}
                    name={quickMessageFormFieldName(type)}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{quickMessageFieldLabel(type)}</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder={getDefaultQuickMessageTemplate(type)}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            ) : null}
          </FormSection>

          <FormSection title="Operación">
            <FormField
              control={form.control}
              name="accessInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instrucciones de acceso</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="houseRules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reglas de la casa</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notificationEmails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correos de administración / recepción</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={"administracion@edificio.com\nrecepcion@edificio.com"}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Opcional. Un correo por línea. Al completar el registro de
                    huéspedes se envía un aviso a estas direcciones.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <FormSection title="Tarifas">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="baseRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa base / noche</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cleaningFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa de aseo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Se suma al total en reservas con presupuesto del calendario.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection title="Estado">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado operativo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(PropertyStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          {propertyStatusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : isEditing ? (
              "Guardar cambios"
            ) : (
              "Crear propiedad"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
