export const ENRICHMENT_FAILURE_MESSAGE = "No fue posible enriquecer el prospecto.";

export const GENERATION_FAILURE_MESSAGE =
  "No fue posible generar prospectos. Verifica APIFY_API_TOKEN o tus créditos de Apify.";

export class OpenAiEnrichmentError extends Error {
  constructor(message: string = ENRICHMENT_FAILURE_MESSAGE) {
    super(message);
    this.name = "OpenAiEnrichmentError";
  }
}

export class ApifyGenerationError extends Error {
  constructor(message: string = GENERATION_FAILURE_MESSAGE) {
    super(message);
    this.name = "ApifyGenerationError";
  }
}
