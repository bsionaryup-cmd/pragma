export type ProspectEnrichmentContent = {
  brief: string;
  whatsapp: string;
  email: string;
  pitch: string;
  objections: string;
  cta: string;
};

export type ProspectEnrichmentResult = {
  notes: string;
  content: ProspectEnrichmentContent;
};
