import {Text} from "react-native";
import {Typography} from "@/constants/theme";
import {useTheme} from "@/context/ThemeContext";
import {DocumentReference} from "@/components/ui/DocumentReference";
import {difference,type MoneyOverview,type MoneyPerson} from "@/lib/invoice-finance";
import {FinancialAmount,FinancialSection} from "./FinancialParts";

export function FinancialAccountSummary({data,selected,view,targeted}:{data:MoneyOverview;selected?:MoneyPerson;targeted:boolean;view:"merchant"|"driver"|"customer"}){
 const {colors}=useTheme();if(!data.admin&&!data.account_reference)return null;
 const treasury=data.admin&&!targeted;
 const role=data.admin?selected?.role:view;
 return <FinancialSection title={treasury?"خزينة المنصة":selected?`حساب ${selected.name}`:targeted?"الحساب المحدد":"ملخص حسابك"}>
  {data.account_reference||selected?.account_reference?<DocumentReference value={selected?.account_reference??data.account_reference!}/>:null}
  {treasury?<FinancialAmount label="نقد الخزينة الفعلي" amount={data.cash??"0"}/>:<FinancialAmount label="الرصيد الصافي — الموجب حق للطرف والسالب عليه" amount={difference(data.payable,data.receivable)}/>}
  <FinancialAmount label={data.admin?targeted?"مستحق للطرف":"مستحق للأطراف":"مستحق لك"} amount={data.payable}/>
  <FinancialAmount label={data.admin?targeted?"مطلوب من الطرف للمنصة":"مطلوب من الأطراف للمنصة":"عليك للمنصة"} amount={data.receivable}/>
  {treasury||role==="driver"?<FinancialAmount label="كامل تحصيل العملاء الواجب تسليمه" amount={data.collection_due}/>:null}
  {treasury||role==="merchant"?<FinancialAmount label="اشتراكات غير مسددة" amount={data.subscription_due}/>:null}
  {role==="driver"?<Text style={{...Typography.body,color:colors.infoForeground,textAlign:"right"}}>تسلّم كامل تحصيل العملاء للمنصة ويصرف أجرك منفصلًا؛ الرصيد الصافي لا يجيز تسليم الفرق.</Text>:null}
 </FinancialSection>;
}
