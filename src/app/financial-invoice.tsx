import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { InvoiceScreen } from "@/components/finance/InvoiceScreen";
import { MerchantInvoiceScreen } from "@/components/finance/MerchantInvoiceScreen";
import { FinancialFeedback } from "@/components/finance/FinancialParts";
import { AppButton } from "@/components/ui/AppButton";
import { AppHeader } from "@/components/navigation/AppHeader";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Spacing } from "@/constants/theme";
import { getAccountRoute, type AccountRoute } from "@/lib/account-routing";

export default function FinancialInvoiceRoute() {
  const { user, loading } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (loading || !user) return <InvoiceScreen />;
  return <AccountInvoice key={user.id} owner={user.id} id={typeof id === "string" ? id : ""} />;
}

function AccountInvoice({ owner, id }: { owner: string; id: string }) {
  const [account, setAccount] = useState<AccountRoute>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void getAccountRoute(owner).then(
      route => { if (active) setAccount(route); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [owner, retry]);

  if (account === "/merchant") return <MerchantInvoiceScreen key={id} owner={owner} id={id} />;
  if (account) return <InvoiceScreen />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="تفاصيل الفاتورة" showBack showNotifications={false} />
      <View style={{ padding: Spacing.four, gap: Spacing.three }}>
        {failed ? <>
          <FinancialFeedback error message="تعذر التحقق من حسابك. تحقق من الاتصال ثم أعد المحاولة." />
          <AppButton title="إعادة المحاولة" variant="outline" onPress={() => { setFailed(false); setRetry(value => value + 1); }} />
          <AppButton title="العودة إلى الحساب" variant="outline" onPress={() => router.replace("/")} />
        </> : <ActivityIndicator color={colors.primary} accessibilityLabel="جارٍ التحقق من الحساب" />}
      </View>
    </View>
  );
}
