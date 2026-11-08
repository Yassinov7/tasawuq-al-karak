import {supabase} from '@/lib/supabase';
import {createFinancialTransport} from '@/lib/financial-transport';
import {c3Money,c3Object} from '@/lib/c3-order-contract';
import {custodyDecimal} from '@/lib/driver-custody-c5';
import type {DriverCollection} from '@/lib/driver-collection';
// Handwritten boundary for LOCAL UNAPPLIED C11. Missing RPC is unavailable, never a total fallback.
const rpc=createFinancialTransport(supabase as unknown as {rpc(name:'get_legacy_delivery_collection',args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>});
export async function readLegacyDeliveryCollection(actor:string,taskId:string,orderId:string):Promise<DriverCollection>{
 const before=await supabase.auth.getUser();if(before.error||before.data.user?.id!==actor)throw Error('تغير حساب السائق.');
 const result=await rpc('get_legacy_delivery_collection',{expected_user:actor,target_task:taskId});
 const after=await supabase.auth.getUser();if(after.error||after.data.user?.id!==actor)throw Error('تغير حساب السائق.');
 if(result.error)return{state:'unavailable'};
 const d=c3Object(result.data);if(d.state!=='ready')return{state:'unavailable'};
 if(d.source!=='legacy_server'||d.task_id!==taskId||d.customer_order_id!==orderId||typeof d.amount!=='string')throw Error('مبلغ المهمة لا يطابق الطلب.');
 // Conversion only for the existing driver display contract; no amount is calculated here.
 return{state:'ready',amount:c3Money(Number(custodyDecimal(d.amount))),source:'legacy_server'};
}
