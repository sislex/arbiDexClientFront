export function eventTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function chartDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function chartTimeOnly(ts: number): string {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function chartCrosshairDateTime(ts: number): string {
  const date = new Date(ts);
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const base = date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  return `${base}.${ms}`;
}
