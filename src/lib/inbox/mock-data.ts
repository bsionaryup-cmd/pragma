import type { InboxConversation } from "@/types/inbox";

/** Una conversación de demostración con datos compatibles PRAGMA. */
export const MOCK_INBOX_CONVERSATIONS: InboxConversation[] = [
  {
    id: "conv-pragma-demo",
    guestName: "María López",
    guestInitial: "M",
    preview:
      "Hola, confirmo llegada a las 3:00 p.m. ¿El código de acceso estará activo?",
    time: "14:32",
    dateRange: "22 may - 25 may",
    status: "open",
    statusLabel: "Abierta",
    propertyImageUrl: null,
    bookingCode: "PRG-20481",
    platform: "AIRBNB",
    propertyName: "Apartamento Laureles · PRAGMA",
    propertyUnit: "Unidad 302",
    propertyId: "demo-property",
    checkIn: "jue. 22 may 26",
    checkOut: "dom. 25 may 26",
    adults: 2,
    nights: 3,
    dueAmount: 0,
    paidAmount: 485000,
    totalAmount: 485000,
    currency: "COP",
    lastMessageAt: "Último mensaje: hoy · 14:32",
    guestEmail: "maria.lopez@email.com",
    guestPhone: "+57 300 000 0000",
    guestLanguage: "Español",
    estimatedArrival: "Llegada estimada: 3:00 PM",
    estimatedDeparture: "Salida: 1:00 PM",
    notes: "Huésped registrado vía PRAGMA",
    dateSeparator: "Hoy",
    messages: [
      {
        id: "m1",
        sender: "guest",
        senderName: "María López",
        senderInitial: "M",
        time: "14:28",
        body: "Hola, confirmo llegada a las 3:00 p.m. ¿El código de acceso estará activo?",
      },
      {
        id: "m2",
        sender: "host",
        senderName: "PRAGMA Host",
        senderInitial: "P",
        time: "14:32",
        body:
          "¡Hola María! Sí, el acceso se activará al completar el registro de huéspedes. Quedamos atentos.",
      },
    ],
  },
];

export const INBOX_UNREAD_COUNT = 1;
