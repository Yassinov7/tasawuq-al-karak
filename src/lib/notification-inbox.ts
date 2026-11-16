export const notificationPageSize = 15;

export type NotificationCursor = { id: string; createdAt: string };

export function notificationCursorFilter(cursor: NotificationCursor) {
  const { id, createdAt } = cursor;
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}

export function appendNotificationPage<T extends NotificationCursor>(previous: T[], page: T[]) {
  const seen = new Set(previous.map(row => row.id));
  return previous.concat(page.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }));
}

// Compare the server's full timestamp precision when resolving the loaded tail.
function timestampKey(value: string) {
  const fraction = value.match(/\.(\d+)/)?.[1] ?? "";
  return Date.parse(value) * 1000 + Number(fraction.padEnd(6, "0").slice(3, 6));
}

export function reachedNotificationCursor(tail: NotificationCursor, target: NotificationCursor) {
  const difference = timestampKey(tail.createdAt) - timestampKey(target.createdAt);
  return difference < 0 || (difference === 0 && tail.id <= target.id);
}

const hour = 60 * 60 * 1000;

export function groupNotifications<T extends NotificationCursor>(items: T[], now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sections = ["آخر ساعة", "اليوم", "أمس", "الأقدم"].map(title => ({ key: title, title, data: [] as T[] }));
  for (const item of items) {
    const time = Date.parse(item.createdAt);
    const index = time > now - hour && time <= now ? 0 : time >= +today ? 1 : time >= +yesterday ? 2 : 3;
    sections[index].data.push(item);
  }
  return sections.filter(section => section.data.length > 0);
}

export function nextNotificationGroupChange(items: NotificationCursor[], now: number) {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  let next = +tomorrow;
  for (const item of items) {
    const time = Date.parse(item.createdAt);
    if (time > now) next = Math.min(next, time);
    else if (time + hour > now) next = Math.min(next, time + hour);
  }
  return next;
}
