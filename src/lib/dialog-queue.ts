export type DialogOptions = { title: string; message: string; confirmText?: string; cancelText?: string; destructive?: boolean };
export type DialogRequest = DialogOptions & { id: number };
/** A single branded dialog at a time. Navigation cancels pending actions rather than accepting them. */
export function createDialogQueue(publish: (request: DialogRequest | null) => void) {
  let sequence = 0;
  const requests: { request: DialogRequest; resolve: (confirmed: boolean) => void }[] = [];
  return {
    show(options: DialogOptions): Promise<boolean> {
      return new Promise(resolve => {
        requests.push({ request: { ...options, id: ++sequence }, resolve });
        if (requests.length === 1) publish(requests[0].request);
      });
    },
    settle(id: number, confirmed: boolean) {
      if (requests[0]?.request.id !== id) return;
      const current = requests.shift()!;
      publish(requests[0]?.request ?? null);
      current.resolve(confirmed);
    },
    cancelAll() {
      const pending = requests.splice(0);
      publish(null);
      pending.forEach(request => request.resolve(false));
    },
  };
}
