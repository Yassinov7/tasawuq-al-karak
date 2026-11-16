export type OfferRemaining = {
  expired: boolean;
  valid: boolean;
  days: number;
  hours: number;
  minutes: number;
};

export function calculateOfferRemaining(endsAt: string | null | undefined, now: number): OfferRemaining {
  const end = endsAt ? Date.parse(endsAt) : NaN;
  if (!Number.isFinite(end)) return { expired: false, valid: false, days: 0, hours: 0, minutes: 0 };
  const milliseconds = Math.max(0, end - now);
  const totalMinutes = milliseconds === 0 ? 0 : Math.ceil(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return { expired: end <= now, valid: true, days, hours, minutes };
}

export function formatOfferCountdown(remaining: OfferRemaining, compact = false) {
  if (!remaining.valid) return null;
  if (remaining.expired) return "انتهى العرض";
  if (!compact) return `متبقٍ ${remaining.days} يوم و${remaining.hours} س و${remaining.minutes} د`;
  if (remaining.days > 0) return `متبقٍ ${remaining.days} يوم و${remaining.hours} س`;
  if (remaining.hours > 0) return `متبقٍ ${remaining.hours} س و${remaining.minutes} د`;
  return `متبقٍ ${remaining.minutes} د`;
}

