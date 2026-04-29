type Level = "info" | "warn" | "error";

function ts() {
  return new Date().toISOString();
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const entry: Record<string, unknown> = { t: ts(), level, msg };
  if (fields) Object.assign(entry, fields);
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
