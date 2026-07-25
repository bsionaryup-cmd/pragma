/**
 * Modelo visual de Assistant Studio (español, orientado a administradores).
 * Se persiste dentro de identity/prompt/guardRails/messages/protocols JSON.
 */

export type StudioInstruction = {
  id: string;
  title: string;
  description: string;
  text: string;
  enabled: boolean;
  sortOrder: number;
};

export type StudioRule = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  /** Si es regla del sistema, no se elimina (solo se desactiva). */
  system?: boolean;
};

export type StudioProtocol = {
  id: string;
  name: string;
  objective: string;
  steps: string;
  questions: string;
  validations: string;
  advanceWhen: string;
  finishWhen: string;
  escalateWhen: string;
  enabled: boolean;
};

export type StudioMessage = {
  id: string;
  key: string;
  category: string;
  title: string;
  description: string;
  body: string;
  enabled: boolean;
};

export type StudioAction = {
  id: string;
  name: string;
  description: string;
  when: string;
  needs: string;
  expects: string;
  enabled: boolean;
  /** Clave técnica interna (tool / pendingAction) — no se muestra como título. */
  systemKey?: string;
};

export const SYSTEM_RULES: StudioRule[] = [
  {
    id: "never_invent",
    title: "Nunca inventar información",
    description:
      "El asistente solo usa datos del negocio o del sistema conectado. Si no sabe algo, pregunta o escala.",
    enabled: true,
    system: true,
  },
  {
    id: "never_confirm_without_validation",
    title: "Nunca confirmar una acción sin validación",
    description:
      "No dirá que una reserva o pago quedó listo hasta que el sistema lo confirme.",
    enabled: true,
    system: true,
  },
  {
    id: "never_double_reply",
    title: "Nunca responder dos veces al mismo mensaje",
    description: "Cada mensaje del huésped genera una sola respuesta.",
    enabled: true,
    system: true,
  },
  {
    id: "never_cross_session",
    title: "Nunca usar información de otra conversación",
    description:
      "Cada chat es independiente. No mezcla datos entre contactos ni sesiones cerradas.",
    enabled: true,
    system: true,
  },
  {
    id: "never_fake_reservation",
    title: "Nunca crear reservas inexistentes",
    description:
      "Solo crea reservas cuando el flujo y las herramientas lo permiten.",
    enabled: true,
    system: true,
  },
  {
    id: "never_assume_availability",
    title: "Nunca asumir disponibilidad",
    description:
      "Siempre consulta el calendario/sistema antes de afirmar que hay cupo.",
    enabled: true,
    system: true,
  },
  {
    id: "never_duplicate_messages",
    title: "Nunca enviar mensajes duplicados",
    description:
      "No reenvía el mismo contenido si el huésped no ha respondido con algo nuevo.",
    enabled: true,
    system: true,
  },
  {
    id: "never_action_without_confirm",
    title: "Nunca ejecutar acciones sin confirmación",
    description:
      "Crear reserva, cobros u otras acciones irreversibles requieren confirmación explícita del huésped.",
    enabled: true,
    system: true,
  },
];

export const DEFAULT_INSTRUCTIONS: StudioInstruction[] = [
  {
    id: "present",
    title: "Presentación",
    description: "Cómo se presenta el asistente al inicio de la conversación.",
    text: "Preséntate siempre como asistente virtual de recepción, nunca como una persona humana.",
    enabled: true,
    sortOrder: 0,
  },
  {
    id: "tone",
    title: "Tono de respuesta",
    description: "Define el estilo de las respuestas cotidianas.",
    text: "Responde de forma clara, breve y profesional, en el idioma del huésped.",
    enabled: true,
    sortOrder: 1,
  },
  {
    id: "ask_info",
    title: "Cómo pedir información",
    description: "Reduce fricción pidiendo datos relacionados juntos.",
    text: "Cuando necesites varios datos del mismo paso (por ejemplo fechas y huéspedes), pídelos en un solo mensaje con un ejemplo sencillo.",
    enabled: true,
    sortOrder: 2,
  },
  {
    id: "confused",
    title: "Cuando no entiende",
    description: "Qué hacer si el mensaje no es claro.",
    text: "Si no entiendes, pide una aclaración breve u ofrece el menú de opciones.",
    enabled: true,
    sortOrder: 3,
  },
  {
    id: "close",
    title: "Cómo cerrar",
    description: "Cierre amable sin continuar solo.",
    text: "Al terminar, confirma el resultado y ofrece ayuda adicional. No continúes el flujo sin un nuevo mensaje del huésped.",
    enabled: true,
    sortOrder: 4,
  },
  {
    id: "topic_change",
    title: "Cambio de tema",
    description: "Cuando el huésped cambia de asunto a mitad de un proceso.",
    text: "Si el huésped cambia de tema de forma clara, confirma el cambio. Si es ambiguo, pregunta si desea pausar el proceso actual.",
    enabled: true,
    sortOrder: 5,
  },
];

export const DEFAULT_PROTOCOLS: StudioProtocol[] = [
  {
    id: "BOOKINGS",
    name: "Disponibilidad y reservas",
    objective: "Consultar disponibilidad y cotizar con datos reales del PMS.",
    steps: "Pedir fechas y huéspedes → consultar → cotizar → confirmar",
    questions: "Fecha de entrada, fecha de salida, número de personas, propiedad",
    validations: "Fechas válidas; no inventar cupos; confirmar antes de crear",
    advanceWhen: "El huésped aporta los datos faltantes",
    finishWhen: "Cotización entregada o reserva creada en el sistema",
    escalateWhen: "Fallo de herramienta, disputa o pedido fuera de alcance",
    enabled: true,
  },
  {
    id: "STAY",
    name: "Estancia (WiFi, ingreso, incidencias)",
    objective: "Ayudar al huésped ya hospedado con información oficial.",
    steps: "Identificar necesidad → consultar datos → responder o escalar",
    questions: "Propiedad o nombre de la reserva cuando haga falta",
    validations: "Solo datos del inventario/PMS; sin inventar claves",
    advanceWhen: "Hay datos suficientes para consultar",
    finishWhen: "Respuesta entregada con fuente oficial",
    escalateWhen: "Emergencia, queja grave o dato no disponible",
    enabled: true,
  },
  {
    id: "PAYMENTS",
    name: "Pagos",
    objective: "Orientar sobre pagos sin inventar montos.",
    steps: "Identificar reserva → consultar → informar o escalar",
    questions: "Nombre del titular / referencia de reserva",
    validations: "Nunca inventar precios ni estados de pago",
    advanceWhen: "Se identifica la reserva",
    finishWhen: "Información de pago entregada o enlace enviado",
    escalateWhen: "Disputa de cobro o dato faltante en sistema",
    enabled: true,
  },
];

export const DEFAULT_MESSAGES: StudioMessage[] = [
  {
    id: "m_welcome",
    key: "welcome_ask_name",
    category: "Bienvenida",
    title: "Saludo y solicitud de nombre",
    description: "Se usa cuando un contacto escribe por primera vez en la sesión. Variables: {{nombre}} {{propiedad}}",
    body: "",
    enabled: true,
  },
  {
    id: "m_post_name",
    key: "welcome_post_name",
    category: "Bienvenida",
    title: "Saludo personalizado + menú",
    description: "Tras conocer el nombre. Variables: {{guestName}} {{menuLines}}",
    body: "",
    enabled: true,
  },
  {
    id: "m_menu",
    key: "menu_main",
    category: "Menú principal",
    title: "Menú de opciones",
    description: "Opciones numeradas del menú principal.",
    body: "",
    enabled: true,
  },
  {
    id: "m_dates",
    key: "ask_dates_guests",
    category: "Disponibilidad",
    title: "Solicitud de fechas y huéspedes",
    description: "Inicio de disponibilidad/reserva. Variables: {{fecha_entrada}} {{fecha_salida}}",
    body: "",
    enabled: true,
  },
  {
    id: "m_soft_dates",
    key: "soft_continue_ask_dates",
    category: "Reserva",
    title: "Recordatorio de fechas",
    description: "Si el huésped saluda a mitad del pedido de fechas.",
    body: "",
    enabled: true,
  },
  {
    id: "m_avail_entry",
    key: "availability_entry",
    category: "Disponibilidad",
    title: "Entrada a disponibilidad / reserva",
    description: "Cuando el huésped elige consultar disponibilidad o reservar.",
    body: "",
    enabled: true,
  },
  {
    id: "m_pay",
    key: "payment_info",
    category: "Pago",
    title: "Información de pago",
    description: "Orientación de pagos. Variables: {{total}} {{nombre}}",
    body: "Con gusto te ayudo con el pago. ¿A nombre de quién está la reserva?",
    enabled: true,
  },
  {
    id: "m_wifi",
    key: "wifi_info",
    category: "WiFi",
    title: "WiFi",
    description: "Cuando piden clave de internet. Variables: {{propiedad}}",
    body: "Con gusto. Consulto el WiFi oficial de la propiedad.",
    enabled: true,
  },
  {
    id: "m_checkin",
    key: "checkin_info",
    category: "Check-in",
    title: "Check-in",
    description: "Consultas de hora o proceso de llegada.",
    body: "Claro. ¿Es sobre la hora de check-in o un cambio de horario?",
    enabled: true,
  },
  {
    id: "m_checkout",
    key: "checkout_info",
    category: "Check-out",
    title: "Check-out",
    description: "Consultas de salida.",
    body: "Claro. ¿Necesitas la hora de check-out o un late check-out?",
    enabled: true,
  },
  {
    id: "m_escalate",
    key: "escalate_human",
    category: "Escalamiento",
    title: "Escalamiento a humano",
    description: "Cuando el asistente debe pasar a recepción.",
    body: "Voy a conectar tu consulta con un asesor humano para ayudarte mejor.",
    enabled: true,
  },
  {
    id: "m_post_booking",
    key: "soft_continue_post_booking",
    category: "Despedida",
    title: "Después de crear la reserva",
    description: "Si el huésped vuelve a saludar tras una reserva creada.",
    body: "",
    enabled: true,
  },
  {
    id: "m_farewell",
    key: "farewell",
    category: "Despedida",
    title: "Despedida",
    description: "Cierre amable de la conversación. Variable: {{nombre}}",
    body: "Que tengas una excelente estadía, {{nombre}}.",
    enabled: true,
  },
];

export const DEFAULT_ACTIONS: StudioAction[] = [
  {
    id: "a_avail",
    name: "Consultar disponibilidad",
    description: "Revisa el calendario del PMS para las fechas indicadas.",
    when: "Cuando el huésped aportó entrada, salida y (si aplica) propiedad",
    needs: "Fechas y propiedad",
    expects: "Disponible / no disponible + resumen de tarifa si existe",
    enabled: true,
    systemKey: "search_availability",
  },
  {
    id: "a_create",
    name: "Crear reserva",
    description: "Registra la reserva en el PMS solo tras confirmación explícita.",
    when: "El huésped confirma el resumen final",
    needs: "Fechas, huéspedes, titular, propiedad",
    expects: "ID de reserva oficial",
    enabled: true,
    systemKey: "create_direct_reservation",
  },
  {
    id: "a_wifi",
    name: "Consultar WiFi",
    description: "Obtiene red y contraseña oficiales de la propiedad.",
    when: "El huésped pide WiFi o clave de internet",
    needs: "Propiedad o reserva vinculada",
    expects: "Datos de WiFi o escalamiento si faltan",
    enabled: true,
    systemKey: "get_property_guest_info",
  },
  {
    id: "a_escalate",
    name: "Escalar a recepción humana",
    description: "Pasa la conversación a una persona del equipo.",
    when: "Emergencia, queja, o el asistente no puede resolver",
    needs: "Resumen del caso",
    expects: "Aviso de que un asesor continúa",
    enabled: true,
    systemKey: "escalate",
  },
];

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
