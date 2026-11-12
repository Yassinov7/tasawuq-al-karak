import type {ReactNode} from "react";
import {Text,View,Pressable} from "react-native";
import {Typography,Spacing,Radius} from "@/constants/theme";
import {useTheme} from "@/context/ThemeContext";
import {DocumentReference} from "@/components/ui/DocumentReference";
import {InvoiceStatus} from "./InvoiceStatus";
import {formatSypExact} from "@/lib/money";
import {invoiceKindLabels,type MoneyInvoice} from "@/lib/invoice-finance";

export function FinancialSection({title,children}:{title?:string;children:ReactNode}){
 const {colors}=useTheme();return <View style={{gap:Spacing.three,padding:Spacing.four,borderWidth:1,borderColor:colors.border,borderRadius:Radius.lg,backgroundColor:colors.surface}}>
  {title?<Text style={{...Typography.cardTitle,color:colors.text,textAlign:"right"}}>{title}</Text>:null}{children}
 </View>;
}
export function FinancialAmount({label,amount}:{label:string;amount:string}){
 const {colors}=useTheme();return <View style={{gap:Spacing.one}}><Text style={{...Typography.body,color:colors.textSecondary,textAlign:"right"}}>{label}</Text><Text selectable style={{...Typography.bodyStrong,color:colors.text,textAlign:"right"}}>{formatSypExact(amount)}</Text></View>;
}
export function FinancialFeedback({message,error=false}:{message:string;error?:boolean}){
 const {colors}=useTheme();return <Text accessibilityRole={error?"alert":undefined} accessibilityLiveRegion="polite" style={{...Typography.body,color:error?colors.errorForeground:colors.infoForeground,backgroundColor:error?colors.errorSurface:colors.infoSurface,padding:Spacing.three,borderRadius:Radius.md,textAlign:"right"}}>{message}</Text>;
}
export function InvoiceListItem({invoice,showOwner,onPress}:{invoice:MoneyInvoice;showOwner:boolean;onPress:()=>void}){
 const {colors}=useTheme();return <Pressable accessibilityRole="button" accessibilityLabel={`${invoice.reference}، ${invoiceKindLabels[invoice.kind]??invoice.title}`} onPress={onPress} style={({pressed})=>({padding:Spacing.four,gap:Spacing.two,borderWidth:1,borderColor:colors.border,borderRadius:Radius.lg,backgroundColor:pressed?colors.surfacePressed:colors.surface,minHeight:64})}>
  <DocumentReference value={invoice.reference}/><Text style={{...Typography.bodyStrong,color:colors.text,textAlign:"right"}}>{invoiceKindLabels[invoice.kind]??invoice.title}{showOwner&&invoice.owner_name?` · ${invoice.owner_name}`:""}</Text>
  <FinancialAmount label="قيمة المستند" amount={invoice.amount}/><InvoiceStatus invoice={invoice}/>
 </Pressable>;
}
