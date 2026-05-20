type IcalSyncLogLevel = "info" | "warn" | "error";

type IcalSyncLogPayload = Record<string, string | number | boolean | null | undefined>;

function emit(level: IcalSyncLogLevel, event: string, payload?: IcalSyncLogPayload) {
  const line = {
    scope: "ical-sync",
    level,
    event,
    at: new Date().toISOString(),
    ...payload,
  };

  const message = `[ical-sync] ${event}`;
  if (level === "error") {
    console.error(message, line);
  } else if (level === "warn") {
    console.warn(message, line);
  } else {
    console.info(message, line);
  }
}

export const icalSyncLog = {
  info: (event: string, payload?: IcalSyncLogPayload) => emit("info", event, payload),
  warn: (event: string, payload?: IcalSyncLogPayload) => emit("warn", event, payload),
  error: (event: string, payload?: IcalSyncLogPayload) => emit("error", event, payload),
};
