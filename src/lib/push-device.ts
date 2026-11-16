import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { isDevice } from "expo-device";
import { Platform } from "react-native";
import { newIdempotencyKey } from "@/lib/request-key";
import { supabase } from "@/lib/supabase";
import { createFinancialTransport } from "@/lib/financial-transport";

const installationKey = "@tasawuq/push-installation-v1";
const api = supabase as unknown as { rpc(name: "register_push_device" | "disable_push_device", args: Record<string, unknown>): PromiseLike<{data: unknown;error:{message:string}|null}> };
const rpc = createFinancialTransport(api);
let installationTask: Promise<string> | undefined;
export type PushRegistrationState = "checking" | "unsupported" | "permission-needed" | "permission-blocked" | "registered" | "registration-failed" | "permission-check-failed";
type RegistrationResult = { ready: boolean; status: PushRegistrationState; message: string };
export function pushUnavailableReason(): string | null {
  if (Platform.OS === "web") return "تنبيهات الجهاز متاحة في نسخة الهاتف.";
  if (isRunningInExpoGo()) return "تنبيهات الهاتف تحتاج إلى نسخة مستقلة من التطبيق. إشعارات حسابك متاحة هنا في Expo Go.";
  if (!isDevice) return "تنبيهات الجهاز غير متاحة هنا. يمكنك متابعة الإشعارات داخل التطبيق.";
  return null;
}
async function installation() {
  if (!installationTask) installationTask = (async () => {
    const previous = await AsyncStorage.getItem(installationKey);
    if (previous) return previous;
    const id = newIdempotencyKey(); await AsyncStorage.setItem(installationKey,id); return id;
  })().catch(error => { installationTask = undefined; throw error; });
  return installationTask;
}
export async function registerPushDevice(owner: string, askPermission: boolean, isCurrent:()=>boolean=()=>true): Promise<RegistrationResult> {
  if(!isCurrent())throw Error("تغير الحساب.");
  const unavailable = pushUnavailableReason();
  if (unavailable) return {ready:false,status:"unsupported",message:unavailable};
  const notifications = await import("expo-notifications");
  if (Platform.OS === "android") await notifications.setNotificationChannelAsync("operations",{name:"الطلبات والفواتير",importance:notifications.AndroidImportance.HIGH,lockscreenVisibility:notifications.AndroidNotificationVisibility.PRIVATE});
  let permission = await notifications.getPermissionsAsync();
  if(!isCurrent())throw Error("تغير الحساب.");
  if (!permission.granted && askPermission && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
  if(!isCurrent())throw Error("تغير الحساب.");
  if (!permission.granted) {
    await disablePushDevice(owner).catch(()=>undefined);
    return permission.canAskAgain
      ? {ready:false,status:"permission-needed",message:"إذن التنبيهات غير ممنوح. يمكنك السماح به لهذا الجهاز."}
      : {ready:false,status:"permission-blocked",message:"إذن التنبيهات موقوف. يمكنك السماح به من إعدادات التطبيق في الهاتف."};
  }
  try {
    await savePushRegistration(owner, isCurrent, notifications);
    return {ready:true,status:"registered",message:"الإذن ممنوح، وسُجّل هذا الجهاز لاستقبال التنبيهات."};
  } catch (error) {
    if (!isCurrent()) throw error;
    return {ready:false,status:"registration-failed",message:"الإذن ممنوح، لكن تعذر تسجيل الجهاز. تحقق من الاتصال وأعد المحاولة."};
  }
}

async function savePushRegistration(owner: string, isCurrent: () => boolean, notifications: typeof import("expo-notifications")) {
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw Error("لم يكتمل إعداد مشروع التنبيهات.");
  let tokenTimer:ReturnType<typeof setTimeout>|undefined;
  const token=await Promise.race([notifications.getExpoPushTokenAsync({projectId}).then(value=>value.data),new Promise<never>((_,reject)=>{tokenTimer=setTimeout(()=>reject(Error("انتهت مهلة تسجيل التنبيهات.")),15000);})]).finally(()=>clearTimeout(tokenTimer));
  if(!isCurrent())throw Error("تغير الحساب.");
  const identity = await supabase.auth.getUser();
  if (identity.error || identity.data.user?.id!==owner) throw Error("تغير الحساب؛ أعد فتح الإشعارات.");
  const installationId=await installation();
  if(!isCurrent())throw Error("تغير الحساب.");
  const result = await rpc("register_push_device",{installation_value:installationId,token_value:token,platform_value:Platform.OS,expected_user:owner});
  if (result.error) throw Error("تعذر تفعيل تنبيهات الجهاز. تحقق من الاتصال وحاول لاحقًا.");
}
/** Best effort before local sign-out; remote messages are generic and always require an owned record to open. */
export async function disablePushDevice(owner: string) {
  const id = await AsyncStorage.getItem(installationKey);
  if (!id) return;
  const result = await rpc("disable_push_device",{installation_value:id,expected_user:owner});
  if (result.error) throw Error("تعذر إلغاء تسجيل تنبيهات الجهاز.");
}
