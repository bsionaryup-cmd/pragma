export { processInboundAirbnbEmail } from "@/modules/airbnb-email/ingestion/process-inbound-email";
export { classifyAirbnbEmail } from "@/modules/airbnb-email/router/airbnb-email-router";
export { matchReservationFromEmailSignals } from "@/modules/airbnb-email/matching/reservation-matcher";
export {
  verifyResendInboundWebhook,
  fetchResendReceivedEmail,
} from "@/modules/airbnb-email/integrations/resend-inbound.client";
export type {
  InboundAirbnbEmailPayload,
  EmailProcessingOutcome,
  ProcessInboundEmailOptions,
} from "@/modules/airbnb-email/types";
