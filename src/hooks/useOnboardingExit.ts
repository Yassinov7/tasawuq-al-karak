import { useCallback, useRef } from "react";
import { Alert, BackHandler } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

export type DraftExitActions = { save: () => Promise<boolean>; discard: () => Promise<boolean>; cancel: () => void };

export function useOnboardingExit({ dirty, busy, save, discard, onBack, confirmExit }: { dirty: boolean; busy: boolean; save?: () => Promise<void>; discard?: () => Promise<void>; onBack?: () => boolean; confirmExit?: (actions: DraftExitActions) => void }) {
  const router = useRouter();
  const open = useRef(false);
  const exit = useCallback(() => {
    if (busy || open.current) return;
    const leave = async (action?: () => Promise<void>) => {
      try { await action?.(); open.current = false; router.replace("/login"); return true; }
      catch { if (!confirmExit) { open.current = false; Alert.alert("تعذر حفظ المسودة", "لم نغادر الصفحة. حاول مرة أخرى."); } return false; }
    };
    if (!dirty) { void leave(); return; }
    open.current = true;
    if (confirmExit) { confirmExit({ save: () => leave(save), discard: () => leave(discard), cancel: () => { open.current = false; } }); return; }
    Alert.alert("مغادرة النموذج؟", "اختر ما تريد فعله بالبيانات المدخلة.", [
      { text: "متابعة التعبئة", style: "cancel", onPress: () => { open.current = false; } },
      ...(save ? [{ text: "حفظ المسودة والعودة", onPress: () => { void leave(save); } }] : []),
      { text: "تجاهل التغييرات والعودة", style: "destructive", onPress: () => { void leave(discard); } },
    ], { cancelable: false });
  }, [busy, confirmExit, dirty, discard, router, save]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (!onBack?.()) exit(); return true; });
    return () => subscription.remove();
  }, [exit, onBack]));
  return exit;
}
