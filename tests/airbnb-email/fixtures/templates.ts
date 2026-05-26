/** Synthetic Airbnb email templates for deterministic tests (ES/EN). */

export const FIXTURE_CONFIRMED_ES = {
  from: "automated@airbnb.com",
  subject: "Reserva confirmada — HM8K2P9Q4X",
  html: `
    <p>Código de confirmación: HM8K2P9Q4X</p>
    <p>Check-in: 2026-06-01</p>
    <p>Check-out: 2026-06-05</p>
    <p>Huésped: Ana García</p>
    <p>Alojamiento: Loft Chapinero Premium</p>
  `,
};

export const FIXTURE_PAYOUT_ES = {
  from: "automated@airbnb.com",
  subject: "Tu pago procesado ha sido enviado",
  body: "Ingresos brutos: $1,200.00 Host service fee: $180.00 Total: $1,020.00 Fecha de pago: 2026-06-10",
};

export const FIXTURE_MESSAGE_EN = {
  from: "express@airbnb.com",
  subject: "New message about your reservation",
  body: "Guest wrote: Can we do early check-in at 11am? Thanks!",
};

export const FIXTURE_REVIEW_PUBLISHED = {
  from: "automated@airbnb.com",
  subject: "Review published",
  body: "Your guest left you a 5 stars review. Review: Great host!",
};

export const FIXTURE_GUEST_REVIEW_SUBMITTED = {
  from: "automated@airbnb.com",
  subject: "Review from Maria",
  body: "Maria left you a review. 5 stars",
};

export const FIXTURE_CANCELED = {
  from: "automated@airbnb.com",
  subject: "Reservation canceled",
  body: "Your reservation was canceled. Confirmation code HMZZ999999",
};

export const FIXTURE_UPDATED = {
  from: "automated@airbnb.com",
  subject: "Your reservation was updated",
  body: "Dates updated for reservation HM8K2P9Q4X",
};

export const FIXTURE_EXTENDED = {
  from: "automated@airbnb.com",
  subject: "Reservation alteration confirmed",
  body: "Your guest requested an extension. Dates updated.",
};

export const FIXTURE_CHECKIN_REMINDER = {
  from: "automated@airbnb.com",
  subject: "Getting ready for check-in tomorrow",
  body: "Check-in: 2026-06-01 Check-out: 2026-06-05",
};

export const FIXTURE_HOST_REVIEW_REQUESTED = {
  from: "automated@airbnb.com",
  subject: "Leave a review for your guest",
  body: "Tell us about your experience with the guest.",
};

export const FIXTURE_UNKNOWN_SPAM = {
  from: "newsletter@marketing.com",
  subject: "Buy now",
  body: "Unrelated promo",
};

export const FIXTURE_TEXT_ONLY = {
  from: "automated@airbnb.com",
  subject: "Reserva confirmada HM7TEXT01",
  text: "Código de confirmación: HM7TEXT01 Check-in: 2026-07-01 Check-out: 2026-07-03",
};
