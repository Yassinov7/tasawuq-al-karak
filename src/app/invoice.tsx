import { useLocalSearchParams } from "expo-router";
import { InvoiceScreen } from "@/components/finance/InvoiceScreen";
import { FinanceScreen } from "@/components/finance/FinanceScreen";
export default function CustomerInvoiceRoute(){const {id,orderId}=useLocalSearchParams<{id?:string;orderId?:string}>();return id||orderId?<InvoiceScreen order/>:<FinanceScreen/>;}
