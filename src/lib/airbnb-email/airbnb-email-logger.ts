type AirbnbEmailLogLevel = "info" | "warn" | "error";

type AirbnbEmailLogPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

function formatPayload(payload?: AirbnbEmailLogPayload): string {
  if (!payload) return "";
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" | ");
}

function emit(
  level: AirbnbEmailLogLevel,
  event: string,
  payload?: AirbnbEmailLogPayload,
) {
  const at = new Date().toISOString();
  const details = formatPayload(payload);
  const summary = details
    ? `[airbnb-email] ${event} | ${details}`
    : `[airbnb-email] ${event}`;

  const structured = {
    scope: "airbnb-email",
    level,
    event,
    at,
    ...payload,
  };

  if (level === "error") {
    console.error(summary);
    console.error(structured);
  } else if (level === "warn") {
    console.warn(summary);
    console.warn(structured);
  } else {
    console.log(summary);
    console.log(structured);
  }
}

export const airbnbEmailLog = {
  info: (event: string, payload?: AirbnbEmailLogPayload) =>
    emit("info", event, payload),
  warn: (event: string, payload?: AirbnbEmailLogPayload) =>
    emit("warn", event, payload),
  error: (event: string, payload?: AirbnbEmailLogPayload) =>
    emit("error", event, payload),
};
