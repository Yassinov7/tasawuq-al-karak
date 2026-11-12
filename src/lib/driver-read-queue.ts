export type DriverReadReason = "initial" | "manual" | "change";

/** One read per focused screen; changes during a read produce one trailing read. */
export function createDriverReadQueue(load: (signal: AbortSignal, reason: DriverReadReason) => Promise<void>) {
  let active = false;
  let controller: AbortController | undefined;
  let running: Promise<void> | undefined;
  let pendingChange = false;
  const request = (reason: DriverReadReason): Promise<void> => {
    if (!active) return Promise.resolve();
    if (running) {
      if (reason === "change") pendingChange = true;
      return running;
    }
    const current = new AbortController();
    controller = current;
    running = Promise.resolve().then(async () => {
      let next = reason;
      do {
        pendingChange = false;
        if (!active || current.signal.aborted) return;
        await load(current.signal, next);
        next = "change";
      } while (active && !current.signal.aborted && pendingChange);
    }).finally(() => {
      if (controller === current) { running = undefined; controller = undefined; }
    });
    return running;
  };
  return {
    request,
    open() { active = true; },
    close() { active = false; controller?.abort(); controller = undefined; running = undefined; pendingChange = false; },
  };
}
