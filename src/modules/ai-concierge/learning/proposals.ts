export type ConciergeLearningProposal = {
  id: string;
  at: string;
  organizationId: string;
  question: string;
  intent: string;
  reason: string;
  status: "proposed";
};

const proposals: ConciergeLearningProposal[] = [];
const CAP = 200;

export function recordLearningProposal(input: {
  organizationId: string;
  question: string;
  intent: string;
  reason: string;
}): ConciergeLearningProposal {
  const row: ConciergeLearningProposal = {
    id: `learn_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    organizationId: input.organizationId,
    question: input.question,
    intent: input.intent,
    reason: input.reason,
    status: "proposed",
  };
  proposals.push(row);
  if (proposals.length > CAP) proposals.splice(0, proposals.length - CAP);
  return row;
}

export function listLearningProposals(limit = 50): ConciergeLearningProposal[] {
  return proposals.slice(-limit);
}
