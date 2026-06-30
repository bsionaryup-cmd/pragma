type PerfPayload = Record<string, string | number | boolean | null | undefined>;

/** Lightweight perf logging — enabled when PRAGMA_PERF_LOG=1 */
export function perfLog(event: string, payload?: PerfPayload): void {
  if (process.env.PRAGMA_PERF_LOG !== "1") return;
  console.info(
    JSON.stringify({
      type: "perf",
      event,
      at: new Date().toISOString(),
      ...payload,
    }),
  );
}

export async function perfMeasure<T>(
  event: string,
  fn: () => Promise<T>,
  payload?: PerfPayload,
): Promise<T> {
  if (process.env.PRAGMA_PERF_LOG !== "1") return fn();
  const started = Date.now();
  try {
    return await fn();
  } finally {
    perfLog(event, { ...payload, durationMs: Date.now() - started });
  }
}
