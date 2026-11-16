import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AccountMenuItem } from "@/components/account/AccountMenuItem";
import { AccountSection } from "@/components/account/AccountSection";
import { AppButton } from "@/components/ui/AppButton";
import { RtlText, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Preferences = Database["public"]["Functions"]["read_store_notification_preferences"]["Returns"];

function useStoreOfferPreferences(owner: string) {
  const [data, setData] = useState<Preferences>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const focused = useRef(false);
  const version = useRef(0);
  const writing = useRef(false);
  const load = useCallback(async () => {
    const request = ++version.current;
    try {
      const result = await supabase.rpc("read_store_notification_preferences", { expected_user: owner });
      if (!focused.current || request !== version.current) return;
      if (result.error?.code === "42501") return;
      if (result.error) throw result.error;
      setData(result.data);
      setError("");
    } catch {
      if (focused.current && request === version.current) setError("تعذر قراءة تفضيلات الإشعارات. أعد المحاولة.");
    }
  }, [owner]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (!writing.current) void load();
    return () => {
      focused.current = false;
      version.current += 1;
    };
  }, [load]));

  async function save(action: { storeId: string; following: boolean } | { enabled: boolean }) {
    if (writing.current) return;
    writing.current = true;
    version.current += 1;
    setBusy(true);
    setError("");
    try {
      const result = "storeId" in action
        ? await supabase.rpc("set_store_notification_follow", {
          expected_user: owner, target_store: action.storeId, following: action.following,
        })
        : await supabase.rpc("set_store_offer_notifications", { expected_user: owner, input_enabled: action.enabled });
      if (result.error) throw result.error;
      if (focused.current) await load();
    } catch {
      if (focused.current) setError("تعذر تأكيد الحفظ. أعد قراءة التفضيلات ثم حاول مجددًا.");
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  return { data, busy, error, load, save };
}

export function StoreOfferFollow({ owner, storeId }: { owner: string; storeId: string }) {
  const state = useStoreOfferPreferences(owner);
  const { colors } = useTheme();
  const [suggest, setSuggest] = useState(false);
  const promptKey = `@tasawuq/offer-follow-prompt/${owner}`;
  const following = state.data?.stores.some(store => store.id === storeId) ?? false;
  const maySuggest = state.data?.enabled === true && !following;
  useFocusEffect(useCallback(() => {
    if (!maySuggest) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        if (await AsyncStorage.getItem(promptKey) || !active) return;
        await AsyncStorage.setItem(promptKey, "shown");
        if (active) setSuggest(true);
      })().catch(() => undefined); // Skip the optional prompt if its dismissal cannot be remembered.
    }, 2500);
    return () => {
      active = false;
      clearTimeout(timer);
      setSuggest(false);
    };
  }, [maySuggest, promptKey]));
  const toggle = () => {
    setSuggest(false);
    void state.save({ storeId, following: !following });
  };
  if (!state.data && !state.error) return null;
  return <View style={styles.group}>
    {state.data ? <AppButton compact fullWidth={false} variant={following ? "secondary" : "outline"}
      icon={following ? "notifications" : "notifications-outline"}
      title={following ? "إيقاف المتابعة" : "متابعة إشعارات المتجر"}
      accessibilityLabel={following ? "تتابع إشعارات هذا المتجر، إيقاف المتابعة" : "متابعة إشعارات المتجر"}
      loading={state.busy} onPress={toggle} /> : null}
    {state.data?.enabled === false && following ? <Text style={[styles.caption, { color: colors.textSecondary }]}>
      إشعارات العروض موقوفة من إعدادات حسابك.
    </Text> : null}
    {maySuggest && suggest ? <View style={styles.group}>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        تابع المتجر لتجد إشعارًا عند بدء عرض جديد.
      </Text>
      <View style={styles.actions}>
        <AppButton compact fullWidth={false} variant="outline" title="ليس الآن" onPress={() => setSuggest(false)} />
      </View>
    </View> : null}
    <PreferenceError error={state.error} retry={state.load} />
  </View>;
}

export function StoreOfferNotificationSettings({ owner }: { owner: string }) {
  const state = useStoreOfferPreferences(owner);
  const { colors } = useTheme();
  const router = useRouter();
  return <View style={styles.sections}>
    <AccountSection compact title="الإشعارات">
      <AccountMenuItem compact icon="phone-portrait-outline" title="تنبيهات الجهاز" subtitle="إذن الهاتف وحالة تسجيل هذا الجهاز"
        isLast onPress={() => router.push("/notifications")} />
      <View style={[styles.settingsIntro, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.text }]}>الطلبات والمعاملات</Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          تظهر تحديثات طلباتك ومعاملاتك في قائمة الإشعارات داخل التطبيق.
        </Text>
      </View>
    </AccountSection>
    <AccountSection compact title="عروض المتاجر">
    <View style={styles.settingsIntro}>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        تفضيل اختياري للمتاجر التي تتابعها. يمكنك إيقاف إشعارات العروض مع إبقاء قائمة المتابعة.
      </Text>
      <PreferenceError error={state.error} retry={state.load} />
      {!state.data && !state.error ? <Text style={[styles.caption, { color: colors.textSecondary }]}>جارٍ قراءة التفضيلات…</Text> : null}
    </View>
    {state.data ? <>
      <AccountMenuItem compact icon="notifications-outline" title={state.data.enabled ? "إيقاف إشعارات العروض" : "تفعيل إشعارات العروض"}
        disabled={state.busy} onPress={() => void state.save({ enabled: !state.data?.enabled })} />
      {state.data.stores.map(store => <View key={store.id} style={[styles.storeRow, { borderColor: colors.borderSubtle }]}>
        <Text style={[styles.storeName, { color: colors.text }]}>{store.name}</Text>
        <AppButton compact fullWidth={false} variant="outline" title="إلغاء المتابعة"
          accessibilityLabel={`إلغاء متابعة ${store.name}`} disabled={state.busy}
          onPress={() => void state.save({ storeId: store.id, following: false })} />
      </View>)}
      {!state.data.stores.length ? <View style={styles.settingsIntro}>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>يمكنك متابعة متجر من صفحة تفاصيله.</Text>
      </View> : null}
    </> : null}
    </AccountSection>
  </View>;
}

function PreferenceError({ error, retry }: { error: string; retry: () => Promise<void> }) {
  const { colors } = useTheme();
  return error ? <View style={styles.group}>
    <Text accessibilityRole="alert" style={[styles.caption, { color: colors.errorForeground }]}>{error}</Text>
    <AppButton compact fullWidth={false} variant="outline" title="إعادة المحاولة" onPress={() => void retry()} />
  </View> : null;
}

const styles = StyleSheet.create({
  group: { gap: Spacing.one, alignItems: "flex-end" },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: Spacing.two },
  caption: { ...Typography.caption, ...RtlText },
  label: { ...Typography.bodyStrong, ...RtlText },
  sections: { marginTop: Spacing.four, gap: Spacing.three },
  storeRow: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", gap: Spacing.two, paddingHorizontal: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  storeName: { ...Typography.bodyStrong, ...RtlText, flexGrow: 1, flexShrink: 1, flexBasis: 120 },
  settingsIntro: { padding: Spacing.three, gap: Spacing.two, alignItems: "flex-end" },
});
