import { useLocalSearchParams } from "expo-router";
import { InvoiceScreen } from "@/components/finance/InvoiceScreen";
import { CustomerInvoicesScreen } from "@/components/finance/CustomerInvoicesScreen";
export default function CustomerInvoiceRoute(){const {id,orderId}=useLocalSearchParams<{id?:string;orderId?:string}>();return id||orderId?<InvoiceScreen order/>:<CustomerInvoicesScreen/>;}
