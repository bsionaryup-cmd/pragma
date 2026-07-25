export type {
  AssistantIdentityConfig,
  AssistantPromptConfig,
  AssistantGuardRailsConfig,
  AssistantMessageTemplates,
  MessageTemplateKey,
  ResolvedAssistantPlaybook,
  KnowledgeProviderDescriptor,
} from "@/modules/assistant-platform/types";

export {
  resolveAssistantPlaybook,
  resolvePlaybookFromVersionId,
  CONCIERGE_SLUG,
} from "@/modules/assistant-platform/resolve-playbook";

export {
  resolveMessage,
  resolveWelcomeAskName,
  resolvePostNameMenu,
  renderTemplate,
} from "@/modules/assistant-platform/resolve-playbook-messages";

export { buildDefaultPlaybook } from "@/modules/assistant-platform/defaults/concierge-defaults";

export {
  ensureConciergeAssistant,
  listOwnerAssistants,
  savePlaybookDraft,
  saveAndPublishPlaybook,
  publishPlaybookVersion,
  upsertKnowledgeArticle,
  deleteKnowledgeArticle,
  listPlaybookVersions,
  restorePlaybookVersion,
  archiveAssistant,
  listTrainingThreads,
  simulateStudioTurn,
  validatePlaybookForPublish,
  studioDefaultsPayload,
} from "@/modules/assistant-platform/studio/service";

export {
  pragmaPmsKnowledgeProvider,
} from "@/modules/assistant-platform/knowledge/pragma-pms-provider";

export {
  PRAGMA_PMS_PROVIDER_META,
} from "@/modules/assistant-platform/knowledge/provider";
