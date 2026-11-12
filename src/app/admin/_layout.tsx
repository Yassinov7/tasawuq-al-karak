import { type Href, Stack, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoleRouteGuard } from "@/components/auth/RoleRouteGuard";
import { AppBottomNav } from "@/components/navigation/AppBottomNav";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNavHeight } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type HeaderConfig = { title: string; backTo?: "/admin" | "/admin/orders" | "/admin/applications" | "/admin/finance" | "/admin/invoices" | "/admin/payments" | "/admin/subscriptions" | "/admin/credit" | "/admin/commissions" | "/admin/ledger" | "/admin/more" | "/admin/stores" | "/admin/drivers" | "/admin/plans" | "/admin/driver-custody" | "/admin/merchant-settlements" | "/admin/financial-reports" };

function getHeaderConfig(pathname: string): HeaderConfig {
  if (pathname === "/admin/orders" || pathname === "/admin/requests") return { title: "الطلبات" };
  if (pathname === "/admin/applications") return { title: "طلبات الانضمام" };
  if (pathname === "/admin/stores") return { title: "المتاجر", backTo: "/admin/more" };
  if (pathname === "/admin/finance") return { title: "المالية" };
  if (pathname === "/admin/financial-indicators") return { title: "المؤشرات المالية", backTo: "/admin/finance" };
  if (pathname === "/admin/financial-reports") return { title: "التقارير المالية", backTo: "/admin/finance" };
  if (pathname === "/admin/cash-movement-report") return { title: "الحركة النقدية", backTo: "/admin/financial-reports" };
  if (pathname === "/admin/delivery-fees-report") return { title: "أجور التوصيل", backTo: "/admin/financial-reports" };
  if (pathname === "/admin/driver-custody-report") return { title: "تقرير عهد السائقين", backTo: "/admin/financial-reports" };
  if (pathname === "/admin/merchant-payouts-report") return { title: "مستحقات التجار", backTo: "/admin/financial-reports" };
  if (pathname === "/admin/platform-revenue-report") return { title: "إيرادات المنصة", backTo: "/admin/financial-reports" };
  if (pathname === "/admin/invoices") return { title: "الفواتير", backTo: "/admin/finance" };
  if (pathname === "/admin/payments") return { title: "المدفوعات والتحصيل", backTo: "/admin/finance" };
  if (pathname === "/admin/subscriptions") return { title: "الاشتراكات", backTo: "/admin/finance" };
  if (pathname === "/admin/credit") return { title: "إدارة الائتمان", backTo: "/admin/finance" };
  if (pathname === "/admin/commissions") return { title: "العمولات", backTo: "/admin/finance" };
  if (pathname === "/admin/ledger") return { title: "السجل المالي", backTo: "/admin/finance" };
  if (pathname === "/admin/merchant-settlements") return { title: "تسويات التجار", backTo: "/admin/finance" };
  if (pathname === "/admin/create-merchant-settlement") return { title: "إنشاء تسوية", backTo: "/admin/merchant-settlements" };
  if (pathname.startsWith("/admin/merchant-settlement-details")) return { title: "تفاصيل التسوية", backTo: "/admin/merchant-settlements" };
  if (pathname === "/admin/driver-custody") return { title: "عهد السائقين", backTo: "/admin/finance" };
  if (pathname === "/admin/more") return { title: "المزيد" };
  if (pathname === "/admin/categories") return { title: "إدارة التصنيفات", backTo: "/admin/more" };
  if (pathname === "/admin/home-ads") return { title: "إعلانات الرئيسية", backTo: "/admin/more" };
  if (pathname === "/admin/drivers") return { title: "السائقون", backTo: "/admin/more" };
  if (pathname === "/admin/plans") return { title: "خطط الاشتراك", backTo: "/admin/finance" };
  if (pathname === "/admin/plan-form") return { title: "نموذج خطة الاشتراك", backTo: "/admin/plans" };
  if (pathname.startsWith("/admin/store-details")) return { title: "تفاصيل المتجر", backTo: "/admin/stores" };
  if (pathname.startsWith("/admin/driver-details")) return { title: "تفاصيل السائق", backTo: "/admin/drivers" };
  if (pathname.startsWith("/admin/application-details")) return { title: "مراجعة طلب الانضمام", backTo: "/admin/applications" };
  if (pathname.startsWith("/admin/merchant-finance")) return { title: "تفاصيل التاجر المالية", backTo: "/admin/finance" };
  if (pathname.startsWith("/admin/invoice-details")) return { title: "تفاصيل الفاتورة", backTo: "/admin/invoices" };
  if (pathname.startsWith("/admin/payment-details")) return { title: "تفاصيل الدفعة", backTo: "/admin/payments" };
  if (pathname.startsWith("/admin/subscription-details")) return { title: "تفاصيل الاشتراك", backTo: "/admin/subscriptions" };
  if (pathname.startsWith("/admin/credit-details")) return { title: "تفاصيل الائتمان", backTo: "/admin/credit" };
  if (pathname.startsWith("/admin/commission-details")) return { title: "تفاصيل العمولة", backTo: "/admin/commissions" };
  if (pathname.startsWith("/admin/ledger-details")) return { title: "تفاصيل القيد", backTo: "/admin/ledger" };
  if (pathname.startsWith("/admin/driver-custody-details")) return { title: "تفاصيل عهدة السائق", backTo: "/admin/driver-custody" };
  if (pathname.startsWith("/admin/order-details")) return { title: "تفاصيل الطلب", backTo: "/admin/orders" };
  return { title: "إدارة المنصة" };
}

export default function AdminLayout() {
  return <RoleRouteGuard role="admin"><AdminLayoutContent /></RoleRouteGuard>;
}

function AdminLayoutContent() {
  const pathname = usePathname();
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const header = pathname === "/admin/plans" || pathname === "/admin/plan-form"
    ? { title: pathname === "/admin/plans" ? "خطط الاشتراك" : "نموذج خطة الاشتراك", backTo: from === "more" ? "/admin/more" : pathname === "/admin/plan-form" ? "/admin/plans" : "/admin/finance" } as HeaderConfig
    : getHeaderConfig(pathname);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((header.backTo ?? "/admin") as Href);
  };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title={header.title} showBack={Boolean(header.backTo)} onBack={goBack} showNotifications mode="business" />
    <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 180, contentStyle: { backgroundColor: colors.background, paddingBottom: BottomNavHeight + insets.bottom } }} />
    <AppBottomNav />
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
