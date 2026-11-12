import type {Href} from "expo-router";
import {supabase} from "@/lib/supabase";
import {isAccountRole} from "@/lib/account-routing";
import {resolveNotificationDestination, type NotificationDestination} from "@/lib/notification-routing";
import {parseNotificationData} from "@/context/NotificationContext";

export class NotificationOpenError extends Error {
 constructor(public readonly reason:"session"|"unavailable"|"network"){super(reason==="session"?"تغيرت جلسة الدخول. افتح الإشعارات من حسابك الحالي.":reason==="unavailable"?"الإشعار أو السجل المرتبط غير متاح لهذا الحساب.":"تعذر فتح الإشعار الآن. تحقق من الاتصال ثم أعد المحاولة.");}
}
export function notificationHref(d:NotificationDestination):Href|undefined{
 switch(d.type){
 case "invoice":return{pathname:"/financial-invoice",params:{id:d.invoiceId}};
 case "application-status":return"/application-status";
 case "admin-application":return{pathname:"/admin/application-details",params:{applicationId:d.applicationId,role:d.role}};
 case "admin-order":return{pathname:"/admin/order-details",params:{orderId:d.orderId}};
 case "customer-order":return{pathname:"/order-details",params:{id:d.orderId}};
 case "merchant-orders":return{pathname:"/merchant/orders",params:d.storeOrderId?{storeOrderId:d.storeOrderId}:{}};
 case "driver-orders":return d.taskId?{pathname:"/driver/task-details",params:{taskId:d.taskId}}:"/driver/orders";
 case "driver-home":return{pathname:"/driver",params:d.taskId?{taskId:d.taskId}:{}};
 case "merchant-home":return"/merchant";
 case "merchant-finance":return"/merchant/finance";
 case "admin-home":return"/admin";
 case "product":return{pathname:"/product-details",params:{id:d.productId}};
 case "store":return{pathname:"/store-details",params:{id:d.storeId}};
 case "offers":return"/home/offers";
 case "customer-home":return"/home";
 case "none":return undefined;
 }
}
/** The same owned-row + target RLS check is used for in-app taps and remote responses. */
export async function openOwnedNotification(owner:string,id:string,current:()=>boolean):Promise<Href>{
 const identity=async()=>{const r=await supabase.auth.getUser();if(!current()||r.error||r.data.user?.id!==owner)throw new NotificationOpenError("session");};
 await identity();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new NotificationOpenError("unavailable");
 const [row,profile]=await Promise.all([supabase.from("notifications").select("data").eq("id",id).eq("user_id",owner).maybeSingle(),supabase.from("profiles").select("role").eq("id",owner).maybeSingle()]);
 await identity();if(row.error||profile.error)throw new NotificationOpenError("network");
 if(!row.data||!profile.data||!isAccountRole(profile.data.role))throw new NotificationOpenError("unavailable");
 const d=resolveNotificationDestination(profile.data.role,parseNotificationData(row.data.data)),href=notificationHref(d);
 if(!href)throw new NotificationOpenError("unavailable");
 let target;
 switch(d.type){
 case "invoice":target=await supabase.from("money_invoices").select("id").eq("id",d.invoiceId).maybeSingle();break;
 case "customer-order":target=await supabase.from("customer_orders").select("id").eq("id",d.orderId).eq("customer_id",owner).maybeSingle();break;
 case "admin-order":target=await supabase.from("customer_orders").select("id").eq("id",d.orderId).maybeSingle();break;
 case "admin-application":target=await supabase.from(d.role==="merchant"?"merchant_applications":"driver_applications").select("id").eq("id",d.applicationId).maybeSingle();break;
 case "merchant-orders":if(d.storeOrderId)target=await supabase.from("store_orders").select("id").eq("id",d.storeOrderId).maybeSingle();break;
 case "driver-orders":if(d.taskId)target=await supabase.from("delivery_tasks").select("id").eq("id",d.taskId).eq("driver_id",owner).maybeSingle();break;
 case "driver-home":if(d.taskId)target=await supabase.from("delivery_tasks").select("id").eq("id",d.taskId).eq("status","available").maybeSingle();break;
 case "product":target=await supabase.from("products").select("id").eq("id",d.productId).maybeSingle();break;
 case "store":target=await supabase.from("stores").select("id").eq("id",d.storeId).maybeSingle();break;
 }
 await identity();if(target?.error)throw new NotificationOpenError("network");if(target&&!target.data)throw new NotificationOpenError("unavailable");
 const marked=await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("user_id",owner);
 await identity();if(marked.error)throw new NotificationOpenError("network");return href;
}
