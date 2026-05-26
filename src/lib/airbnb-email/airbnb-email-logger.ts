type AirbnbEmailLogLevel = "info" | "warn" | "error";

type AirbnbEmailLogPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

function emit(
  level: AirbnbEmailLogLevel,
  event: string,
  payload?: AirbnbEmailLogPayload,
) {
  const line = {
    scope: "airbnb-email",
    level,
    event,
    at: new Date().toISOString(),
    ...payload,
  };

  const message = `[airbnb-email] ${event}`;
  if (level === "error") {
    console.error(message, line);
  } else if (level === "warn") {
    console.warn(message, line);
  } else {
    console.info(message, line);
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
