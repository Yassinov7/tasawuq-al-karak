import { useCallback, useRef } from "react";
import { BackHandler, Keyboard } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppDialog } from "@/context/AppDialogContext";

export function useOnboardingExit({ dirty, busy, onBack }: { dirty: boolean; busy: boolean; onBack?: () => boolean }) {
  const router = useRouter();
  const { confirm } = useAppDialog();
  const open = useRef(false);
  const exit = useCallback(() => {
    if (busy || open.current) return;
    Keyboard.dismiss();
    if (!dirty) { router.replace("/login"); return; }
    open.current = true;
    void confirm({ title: "العودة دون حفظ؟", message: "لم تُرسل هذه البيانات بعد. يمكنك متابعة التعبئة أو تجاهلها والعودة.", confirmText: "تجاهل والعودة", cancelText: "متابعة التعبئة", destructive: true })
      .then(accepted => { if (accepted) router.replace("/login"); })
      .finally(() => { open.current = false; });
  }, [busy, dirty, router, confirm]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      // Android back closes the keyboard before navigating a form step.
      if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; }
      if (!onBack?.()) exit();
      return true;
    });
    return () => subscription.remove();
  }, [exit, onBack]));
  return exit;
}
