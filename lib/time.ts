export const STUDIO_TIME_ZONE =
  process.env.NEXT_PUBLIC_STUDIO_TIME_ZONE || "Asia/Ho_Chi_Minh";

export const STUDIO_UTC_OFFSET = process.env.STUDIO_UTC_OFFSET || "+07:00";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseUtcOffsetToMs(offset: string) {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 7 * 60 * 60 * 1000;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

export function datetimeLocalToIso(value: string) {
  if (!value) throw new Error("Thiếu thời gian lớp học");
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

export function getStudioWeekRangeIso(referenceDate = new Date()) {
  const offsetMs = parseUtcOffsetToMs(STUDIO_UTC_OFFSET);
  const localNow = new Date(referenceDate.getTime() + offsetMs);

  const localYear = localNow.getUTCFullYear();
  const localMonth = localNow.getUTCMonth();
  const localDate = localNow.getUTCDate();
  const localDay = localNow.getUTCDay(); // 0 = Sunday, 1 = Monday
  const daysSinceMonday = (localDay + 6) % 7;

  const mondayLocalMidnightMs = Date.UTC(localYear, localMonth, localDate - daysSinceMonday, 0, 0, 0, 0);
  const weekStartUtcMs = mondayLocalMidnightMs - offsetMs;
  const weekEndUtcMs = weekStartUtcMs + 7 * ONE_DAY_MS;

  return {
    startIso: new Date(weekStartUtcMs).toISOString(),
    endIso: new Date(weekEndUtcMs).toISOString(),
  };
}

export function formatWeekRange(startIso: string, endIso: string) {
  const start = new Intl.DateTimeFormat("vi-VN", {
    timeZone: STUDIO_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(startIso));

  const endDate = new Date(new Date(endIso).getTime() - 1);
  const end = new Intl.DateTimeFormat("vi-VN", {
    timeZone: STUDIO_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(endDate);

  return `${start} - ${end}`;
}

export function hasClassStarted(startsAt: string) {
  return new Date(startsAt).getTime() <= Date.now();
}
