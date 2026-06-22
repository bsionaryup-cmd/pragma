export type ProspectEnrichmentContent = {
  brief: string;
  whatsapp: string;
  email: string;
  phonePitch: string;
  objections: string;
  cta: string;
};

export type ProspectEnrichmentResult = {
  notes: string;
  content: ProspectEnrichmentContent;
};
