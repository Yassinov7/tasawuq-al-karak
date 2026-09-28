import { useRouter } from "expo-router";
import { ScrollView, Text } from "react-native";

import { WorkspaceCard, WorkspaceFrame, WorkspaceTitle } from "@/components/workspace/WorkspaceUI";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useTheme } from "@/context/ThemeContext";

export default function MerchantHome() {
  const router = useRouter(); const { colors } = useTheme(); const { merchantApproval, stores } = useWorkspace();
  return <WorkspaceFrame title="مساحة التاجر"><ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
    <WorkspaceTitle title="إدارة متاجرك" detail="الفروع والمنتجات والطلبات في مكان واحد" />
    {merchantApproval !== "approved" ? <Text style={{ marginHorizontal: 16, marginTop: 16, padding: 14, color: colors.accent, backgroundColor: colors.accentLight, textAlign: "right", borderRadius: 12 }}>طلب التاجر قيد مراجعة الإدارة. ستُتاح أدوات البيع بعد الموافقة.</Text> : null}
    <WorkspaceCard title="متاجري وفروعي" detail={`${stores.length} متجر · إدارة الفروع وإعداداتها`} icon="storefront-outline" onPress={() => router.push("/merchant/stores")} />
    <WorkspaceCard title="المنتجات والأسعار" detail="إضافة المنتجات وتعديل السعر والتوفر" icon="pricetag-outline" onPress={() => router.push("/merchant/products")} />
    <WorkspaceCard title="العروض والتخفيضات" detail="إنشاء عروض بمدة محددة وإدارتها لكل فرع" icon="pricetags-outline" onPress={() => router.push("/merchant/offers")} />
    <WorkspaceCard title="اشتراك المتجر" detail="الخطة والعمولة وتاريخ انتهاء الاشتراك" icon="card-outline" onPress={() => router.push("/merchant/subscription")} />
    <WorkspaceCard title="طلبات المتاجر" detail="قبول الطلبات ومتابعة التجهيز" icon="receipt-outline" onPress={() => router.push("/merchant/orders")} />
    <WorkspaceCard title="الحسابات والفواتير" detail="مستحقات الفروع والعمولات والدفعات" icon="wallet-outline" onPress={() => router.push("/merchant/finance")} />
    <WorkspaceCard title="العودة إلى التسوق" detail="استخدام حساب الزبون من الحساب نفسه" icon="cart-outline" onPress={() => router.replace("/home")} />
  </ScrollView></WorkspaceFrame>;
}
