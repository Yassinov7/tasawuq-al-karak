import { C3DeliverySettings } from "@/components/admin/C3DeliverySettings";
import {useRouter} from "expo-router";
import {AccountShell} from "@/components/account/AccountShell";
import {AccountSection} from "@/components/account/AccountSection";
import {AccountMenuItem} from "@/components/account/AccountMenuItem";
import {SharedAccountIdentity,SharedAccountMenu,AccountLogout} from "@/components/account/SharedAccountParts";
type PlatformItem = {
  title: string;
  subtitle: string;
  icon: "storefront-outline" | "bicycle-outline" | "pricetags-outline" | "wallet-outline" | "cash-outline";
  route: "/admin/stores" | "/admin/drivers" | "/admin/plans?from=more" | "/admin/finance" | "/admin/driver-custody";
};

const platformItems: PlatformItem[] = [
  { title: "المتاجر القائمة", subtitle: "إدارة المتاجر المعتمدة وبياناتها", icon: "storefront-outline", route: "/admin/stores" },
  { title: "السائقون المعتمدون", subtitle: "متابعة السائقين والتوصيلات الحالية", icon: "bicycle-outline", route: "/admin/drivers" },
  { title: "خطط الاشتراك", subtitle: "إدارة الخطط المتاحة للمتقدمين الجدد", icon: "pricetags-outline", route: "/admin/plans?from=more" },
  { title: "المالية والاشتراكات", subtitle: "الحسابات والفواتير والمدفوعات بالليرة السورية", icon: "wallet-outline", route: "/admin/finance" },
  { title: "عهد السائقين", subtitle: "استلام النقد المؤكد ومتابعة العهدة بالليرة السورية", icon: "cash-outline", route: "/admin/driver-custody" },
];

export default function AdminMoreScreen(){
 const router=useRouter();return <AccountShell header={null}><SharedAccountIdentity expectedRole="admin"/>
 <AccountSection title="إدارة المنصة" subtitle="الانضمام ومراجعة الطلبات في التبويب المخصص لهما." icon="grid-outline">
 {platformItems.map((item,index)=><AccountMenuItem key={item.route} title={item.title} subtitle={item.subtitle} icon={item.icon} isLast={index===platformItems.length-1} onPress={()=>router.push(item.route)}/>)}</AccountSection>
 <C3DeliverySettings/>
 <SharedAccountMenu role="admin"/><AccountLogout/>
 </AccountShell>;
}
