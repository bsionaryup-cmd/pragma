/**
 * Plantillas oficiales de PRAGMA para mensajes copiar/pegar al huésped.
 * Fuente única de verdad: nuevas propiedades y "usar predeterminados" heredan de aquí.
 */

export const QUICK_MESSAGE_TYPE_ORDER = [
  "WELCOME",
  "REGISTRATION",
  "ACCESS",
  "FOLLOW_UP",
  "HOUSE_RULES",
  "CHECKOUT",
  "REVIEW",
] as const;

export type QuickMessageType = (typeof QUICK_MESSAGE_TYPE_ORDER)[number];

export const DEFAULT_MESSAGE_TITLES: Record<QuickMessageType, string> = {
  WELCOME: "Reserva confirmada",
  REGISTRATION: "Registro de huéspedes",
  ACCESS: "Información de llegada",
  FOLLOW_UP: "Bienvenida durante la estadía",
  HOUSE_RULES: "Reglas importantes",
  CHECKOUT: "Recordatorio de salida",
  REVIEW: "Agradecimiento y reseña",
};

export const DEFAULT_MESSAGE_BUTTON_LABELS: Record<QuickMessageType, string> = {
  WELCOME: "✅ Reserva confirmada",
  REGISTRATION: "🪪 Registro de huéspedes",
  ACCESS: "🚪 Información de llegada",
  FOLLOW_UP: "🏠 Bienvenida durante la estadía",
  HOUSE_RULES: "⚠️ Reglas importantes",
  CHECKOUT: "👋 Recordatorio de salida",
  REVIEW: "⭐ Agradecimiento y reseña",
};

export const DEFAULT_MESSAGE_TEMPLATES: Record<QuickMessageType, string> = {
  WELCOME: `Hola {guestName},

¡Gracias por elegir {propertyName}!

Tu reserva está confirmada para {stayRange}.

Por ahora no necesitas hacer nada. Más cerca de tu llegada te compartiremos toda la información necesaria para que tu check-in sea rápido y sencillo.

Si tienes alguna pregunta antes de tu viaje, estaremos atentos en:

{receptionWhatsapp}

¡Nos vemos pronto!`,

  REGISTRATION: `Hola {guestName},

Para preparar tu llegada y agilizar el check-in, por favor completa el registro de huéspedes en el siguiente enlace:

{registrationLink}

Si tienes alguna duda o necesitas ayuda, puedes comunicarte con nosotros en:

{receptionWhatsapp}

Muchas gracias.`,

  ACCESS: `Hola {guestName},

Te compartimos la información para tu llegada a {propertyName}.

📍 Dirección:
{address}

🕒 Check-in:
Desde las {checkInTime}

🔐 Código de acceso:
{accessCode}

📋 Instrucciones de acceso:
{accessInstructions}

📞 Si necesitas ayuda durante tu llegada o en cualquier momento de tu estancia, estaremos disponibles en:

{receptionWhatsapp}

Te recomendamos conservar este mensaje, ya que contiene toda la información importante para tu estancia.

¡Buen viaje!`,

  FOLLOW_UP: `Hola {guestName},

Esperamos que hayas llegado bien y que estés disfrutando de tu estancia en {propertyName}.

📶 WiFi:
{wifiName}

🔑 Contraseña:
{wifiPassword}

Si necesitas cualquier cosa o tienes alguna novedad, estaremos disponibles en:

{receptionWhatsapp}

¡Que disfrutes tu estancia!`,

  HOUSE_RULES: `⚠️ Recordatorios importantes

• Solo se permiten los huéspedes registrados en la reserva.

• No están permitidas las fiestas ni eventos.

• Por respeto a los vecinos, agradecemos mantener niveles moderados de ruido durante la noche.

• Antes de salir, recuerda apagar luces y aire acondicionado cuando no estén en uso.

Gracias por ayudarnos a mantener un ambiente agradable para todos.`,

  CHECKOUT: `Hola {guestName},

Esperamos que hayas disfrutado tu estadía en {propertyName}.

⏰ El check-out es antes de las {checkOutTime}.

Antes de salir, te pedimos:

• Verificar que no queden objetos personales.

• Apagar luces y aire acondicionado.

• Cerrar puertas y ventanas.

Si necesitas alguna asistencia, estaremos atentos en:

{receptionWhatsapp}

Muchas gracias por hospedarte con nosotros.`,

  REVIEW: `Hola {guestName},

Muchas gracias por haberte hospedado en {propertyName}.

Esperamos que hayas disfrutado tu estadía.

Si todo estuvo bien, una reseña en Airbnb nos ayuda muchísimo y nos permite seguir ofreciendo una excelente experiencia a futuros huéspedes.

Será un placer recibirte nuevamente.

¡Buen viaje y hasta una próxima oportunidad!`,
};

export function getDefaultMessageTemplate(type: QuickMessageType): string {
  return DEFAULT_MESSAGE_TEMPLATES[type];
}

export function getDefaultMessageTitle(type: QuickMessageType): string {
  return DEFAULT_MESSAGE_TITLES[type];
}

export function getQuickMessageButtonLabel(type: QuickMessageType): string {
  return DEFAULT_MESSAGE_BUTTON_LABELS[type];
}

/** Rellena el formulario de personalización con las plantillas oficiales. */
export function defaultMessageTemplatesToFormFields(): Record<
  `quickMessage${QuickMessageType}`,
  string
> {
  return Object.fromEntries(
    QUICK_MESSAGE_TYPE_ORDER.map((type) => [
      `quickMessage${type}`,
      DEFAULT_MESSAGE_TEMPLATES[type],
    ]),
  ) as Record<`quickMessage${QuickMessageType}`, string>;
}
