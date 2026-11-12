import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "expo-router";
import { AppModal } from "@/components/ui/AppModal";
import { useAuth } from "@/context/AuthContext";
import { createDialogQueue, type DialogOptions, type DialogRequest } from "@/lib/dialog-queue";

type AppDialogs = { confirm: (options: DialogOptions) => Promise<boolean>; alert: (title: string, message: string) => Promise<boolean> };
const AppDialogContext = createContext<AppDialogs | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const queue = useMemo(() => createDialogQueue(setRequest), []);
  const pathname = usePathname();
  const { user } = useAuth();
  useEffect(() => { queue.cancelAll(); return () => queue.cancelAll(); }, [queue, pathname, user?.id]);
  const value = useMemo<AppDialogs>(() => ({
    confirm: options => queue.show({ confirmText: "تأكيد", cancelText: "إلغاء", ...options }),
    alert: (title, message) => queue.show({ title, message, confirmText: "حسنًا" }),
  }), [queue]);
  return <AppDialogContext.Provider value={value}>
    {children}
    <AppModal design="refined" visible={request !== null} title={request?.title ?? ""} message={request?.message} confirmText={request?.confirmText} cancelText={request?.cancelText} destructive={request?.destructive} onConfirm={() => { if (request) queue.settle(request.id, true); }} onCancel={() => { if (request) queue.settle(request.id, false); }}/>
  </AppDialogContext.Provider>;
}
export function useAppDialog(): AppDialogs {
  const context = useContext(AppDialogContext);
  if (!context) throw Error("useAppDialog requires AppDialogProvider");
  return context;
}
