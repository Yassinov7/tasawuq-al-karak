/** One committed owner/filter scope. Close invalidates every outstanding response. */
export function createReadScope() {
  let active = false, epoch = 0;
  return {
    open() { active = true; },
    close() { active = false; epoch++; },
    begin() { return ++epoch; },
    current(token: number) { return active && token === epoch; },
  };
}
