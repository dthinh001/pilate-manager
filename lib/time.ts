export const STUDIO_TIME_ZONE =
  process.env.NEXT_PUBLIC_STUDIO_TIME_ZONE || "Asia/Ho_Chi_Minh";

export const STUDIO_UTC_OFFSET = process.env.STUDIO_UTC_OFFSET || "+07:00";

export function datetimeLocalToIso(value: string) {
  if (!value) throw new Error("Missing datetime value");
  const normalized = value.length === 16 ? `${value}:00` : value;
  return new Date(`${normalized}${STUDIO_UTC_OFFSET}`).toISOString();
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: STUDIO_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  const start = new Intl.DateTimeFormat("vi-VN", {
    timeZone: STUDIO_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));

  const end = new Intl.DateTimeFormat("vi-VN", {
    timeZone: STUDIO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(endsAt));

  return `${start} - ${end}`;
}

export function nowIso() {
  return new Date().toISOString();
}
