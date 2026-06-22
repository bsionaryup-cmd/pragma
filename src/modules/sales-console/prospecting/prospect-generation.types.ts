export type ProspectGenerationRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export type StartProspectGenerationResult =
  | { success: true; runId: string }
  | { success: false; error: string };

export type ImportGeneratedProspectsResult =
  | { success: true; status: "RUNNING" }
  | { success: true; status: "SUCCEEDED"; imported: number; skippedInvalid: number; skippedDuplicate: number }
  | { success: false; status: "FAILED"; error: string };
