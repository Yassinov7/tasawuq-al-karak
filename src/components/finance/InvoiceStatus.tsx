import { Text, View } from "react-native";
import { Typography, Spacing, Radius } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { invoicePresentation } from "@/lib/invoice-presentation";
import type { MoneyInvoice } from "@/lib/invoice-finance";

export function InvoiceStatus({invoice}:{invoice:Pick<MoneyInvoice,"status"|"voided_by"|"dues">}) {
 const {colors}=useTheme(),state=invoicePresentation(invoice);
 const color=state.tone==="success"?colors.successForeground:state.tone==="info"?colors.infoForeground:colors.textSecondary;
 const backgroundColor=state.tone==="success"?colors.successSurface:state.tone==="info"?colors.infoSurface:colors.mutedSurface;
 return <View style={{flexDirection:"row-reverse",flexWrap:"wrap",gap:Spacing.two}}>
  <Text style={{...Typography.caption,color:colors.textSecondary}}>المستند: {state.document}</Text>
  {state.payment?<Text style={{...Typography.bodyStrong,color,backgroundColor,paddingHorizontal:Spacing.two,paddingVertical:Spacing.one,borderRadius:Radius.sm}}>السداد: {state.payment}</Text>:null}
 </View>;
}
