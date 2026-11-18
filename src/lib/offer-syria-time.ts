import { parseOfferDay } from "@/lib/offer-expiration";

export const offerTimeZone = "Asia/Damascus";
const pad = (value: number) => String(value).padStart(2, "0");
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: offerTimeZone, calendar: "gregory", numberingSystem: "latn",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function syriaOfferFields(value: string | number | Date) {
  const date = new Date(value instanceof Date ? value.getTime() : value);
  if (!Number.isFinite(date.getTime())) throw new Error("الموعد غير صالح.");
  const parts = Object.fromEntries(clockFormatter.formatToParts(date).map(part => [part.type, part.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  const hour = Number(parts.hour), minute = Number(parts.minute), second = Number(parts.second);
  return { year, month, day, hour, minute, second,
    date: `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}` };
}

function utcWallClock(parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number }) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second ?? 0, 0);
  return date.getTime();
}

/** Invert IANA-zone wall time, including historical gaps/overlaps, independently of the device. */
export function syriaOfferInstant(dateText: string, timeText: string): string {
  const day = parseOfferDay(dateText);
  if (!/^\d{2}:\d{2}$/.test(timeText)) throw new Error("أدخل الساعة والدقيقة بنظام 24 ساعة.");
  const [hour, minute] = timeText.split(":").map(Number);
  if (hour > 23 || minute > 59) throw new Error("الساعة من 00 إلى 23، والدقيقة من 00 إلى 59.");
  const wall = utcWallClock({ ...day, hour, minute });
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours * 3600000;
    offsets.add(utcWallClock(syriaOfferFields(sample)) - sample);
  }
  const candidates = [...offsets].map(offset => wall - offset).filter(instant => {
    const parts = syriaOfferFields(instant);
    return parts.date === dateText && parts.hour === hour && parts.minute === minute;
  });
  if (!candidates.length) throw new Error("هذا الوقت غير موجود في توقيت سوريا بسبب تغيير الساعة. اختر وقتًا آخر.");
  if (candidates.length > 1) throw new Error("هذا الوقت يتكرر في توقيت سوريا. اختر وقتًا آخر خارج الفترة المكررة.");
  return new Date(candidates[0]).toISOString();
}

export function validateSyriaOfferTime(date: string, time: string, now: number, startsAt?: string) {
  const instant = syriaOfferInstant(date, time);
  if (Date.parse(instant) <= now) throw new Error("اختر موعدًا مستقبليًا، أو «يبدأ الآن» لبداية العرض.");
  if (startsAt && Date.parse(instant) <= Date.parse(startsAt)) throw new Error("يجب أن يكون موعد الانتهاء بعد بداية العرض.");
  return instant;
}

export function canSelectSyriaOfferDay(date: string, now: number, startsAt?: string) {
  parseOfferDay(date);
  const lowerBound = Math.max(now, startsAt ? Date.parse(startsAt) : now);
  const firstDay = syriaOfferFields(lowerBound).date;
  if (date < firstDay) return false;
  if (date > firstDay) return true;
  return Date.parse(syriaOfferInstant(date, "23:59")) > lowerBound;
}

export function keepsSavedSyriaOfferTime(original: string | null, date: string, time: string) {
  if (!original) return false;
  const saved = syriaOfferFields(original);
  return saved.date === date && saved.time === time;
}

export function formatSyriaOfferTime(value: string) {
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: offerTimeZone, calendar: "gregory", weekday: "long",
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}
