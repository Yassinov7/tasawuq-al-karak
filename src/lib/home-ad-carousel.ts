export const stillAdMs = 5_000;
export const videoAdLimitMs = 15_000;

export function nextAdIndex(index: number, size: number, direction: 1 | -1) {
  return size ? (index + direction + size) % size : 0;
}

export function adSwipeDirection(dx: number): 1 | -1 | null {
  if (Math.abs(dx) < 36) return null;
  return dx > 0 ? 1 : -1;
}
