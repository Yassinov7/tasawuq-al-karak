import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { LayoutSpacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { DraftExitActions } from "@/hooks/useOnboardingExit";

export function DraftExitModal({ actions, onClose }: { actions: DraftExitActions | null; onClose: () => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const stay = () => { if (!lock.current) { actions?.cancel(); setError(""); onClose(); } };
  const leave = async (kind: "save" | "discard") => {
    if (!actions || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (await actions[kind]()) onClose();
      else setError("تعذر إكمال العملية. بقيت بياناتك في النموذج؛ حاول مرة أخرى.");
    } finally { lock.current = false; setBusy(false); }
  };
  return <AppModal design="refined" visible={Boolean(actions)} title="هل تريد مغادرة طلب المتجر؟" icon="document-text-outline"
    message="يمكنك حفظ المسودة للعودة إليها لاحقًا. تجاهل التغييرات يعيد المسودة السابقة، ولا يرسل الطلب."
    busy={busy} onCancel={stay} actions={<View style={{ gap: LayoutSpacing.actionGap }}>
      <AppButton design="refined" title="حفظ المسودة والعودة" loading={busy} onPress={() => void leave("save")} />
      <AppButton design="refined" title="متابعة التعبئة" variant="outline" disabled={busy} onPress={stay} />
      <AppButton design="refined" title="تجاهل التغييرات والعودة" variant="danger" disabled={busy} onPress={() => void leave("discard")} />
    </View>}>
    {error ? <Text accessibilityRole="alert" style={[Typography.body, { color: colors.errorForeground, textAlign: "right", marginVertical: 8 }]}>{error}</Text> : null}
  </AppModal>;
}
