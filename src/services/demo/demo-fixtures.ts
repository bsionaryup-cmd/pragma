export type DemoProperty = {
  id: string;
  name: string;
  city: string;
  occupancy: number;
};

export type DemoReservation = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "pending" | "blocked";
  amount: number;
};

export const DEMO_PROPERTIES: DemoProperty[] = [
  { id: "d1", name: "Loft Laureles", city: "Medellín", occupancy: 82 },
  { id: "d2", name: "Suite Poblado", city: "Medellín", occupancy: 91 },
  { id: "d3", name: "Estudio Centro", city: "Bogotá", occupancy: 74 },
];

export const DEMO_RESERVATIONS: DemoReservation[] = [
  {
    id: "r1",
    propertyId: "d1",
    guestName: "Camila R.",
    checkIn: "2026-05-22",
    checkOut: "2026-05-25",
    status: "confirmed",
    amount: 450_000,
  },
  {
    id: "r2",
    propertyId: "d2",
    guestName: "James T.",
    checkIn: "2026-05-23",
    checkOut: "2026-05-28",
    status: "confirmed",
    amount: 820_000,
  },
  {
    id: "r3",
    propertyId: "d3",
    guestName: "Bloqueo limpieza",
    checkIn: "2026-05-24",
    checkOut: "2026-05-25",
    status: "blocked",
    amount: 0,
  },
];

export const DEMO_KPIS = {
  occupancy: 84,
  revenueMonth: 12_400_000,
  arrivalsToday: 2,
  departuresToday: 1,
};
