export const DEFAULT_DOOR_STEPS = [
  {
    title: "Toca el teclado",
    body: "Activa la cerradura tocando el teclado.",
  },
  {
    title: "Ingresa tu código",
    body: "Escribe el código de acceso y confirma.",
  },
  {
    title: "Si el código no funciona",
    body: "Si ingresas el código incorrectamente 3 veces, la cerradura se bloqueará. Espera 3 a 5 minutos e inténtalo de nuevo.",
  },
] as const;

export const DEFAULT_HOUSE_RULES = [
  "Solo está permitido el ingreso de los huéspedes registrados.",
  "No se permiten fiestas ni eventos.",
  "Evita ruidos fuertes, especialmente de noche.",
  "Apaga las luces y el aire acondicionado cuando salgas.",
  "Cuida el apartamento y tus pertenencias.",
] as const;

export const DOOR_FOOTER =
  "Antes de salir, verifica que la puerta y las ventanas queden bien cerradas.";

export const HOUSE_RULES_FOOTER =
  "¡Gracias por cuidar el alojamiento! Esperamos que disfrutes tu estadía.";

export const STAY_SECURITY_FOOTER =
  "Tu seguridad es nuestra prioridad. Disfruta tu estancia.";
