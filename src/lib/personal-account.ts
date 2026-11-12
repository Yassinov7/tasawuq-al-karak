import { disablePushDevice } from "@/lib/push-device";
import type {Database} from '@/types/database';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { invalidateLocalCache } from '@/lib/local-cache';
import { personalValues, samePersonal, type PersonalDraft } from '@/lib/personal-account-model';
const columns='id,full_name,age_range,gender,role,updated_at,birth_date' as const;
const saving=new Set<string>();
function boundClient(token:string){return createClient<Database>(process.env.EXPO_PUBLIC_SUPABASE_URL!,process.env.EXPO_PUBLIC_SUPABASE_KEY!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
async function accountFetch(input:Parameters<typeof fetch>[0]|URL,init?:Parameters<typeof fetch>[1]){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000),cancel=()=>controller.abort();
 init?.signal?.addEventListener('abort',cancel,{once:true});if(init?.signal?.aborted)cancel();
 try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timer);init?.signal?.removeEventListener('abort',cancel);}
}
export async function deadline<T>(task:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([task,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('انتهت مهلة الاتصال. تحقق من النتيجة.')),15000);})]);}finally{if(timer)clearTimeout(timer);}}

export async function assertAccount(owner:string){
 const {data,error}=await supabase.auth.getSession();
 if(error||data.session?.user.id!==owner)throw Error('تغير الحساب. افتح الصفحة من جديد.');
 return data.session;
}
export async function readPersonalAccount(owner:string,signal?:AbortSignal){
 const session=await assertAccount(owner),db=boundClient(session.access_token);
 const timer=new AbortController();const timeout=setTimeout(()=>timer.abort(),15000);
 const cancel=()=>timer.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
  const {data:auth,error:authError}=await deadline(supabase.auth.getUser());
  if(authError||auth.user?.id!==owner)throw Error('تعذر التحقق من الحساب. حاول مجددًا.');
  const result=await db.from('profiles').select(columns).eq('id',owner).abortSignal(timer.signal).single();
  await assertAccount(owner);if(timer.signal.aborted)throw Error('انتهت مهلة تحميل الحساب. أعد المحاولة.');
  if(result.error||!result.data)throw Error('تعذر تحميل بيانات الحساب. أعد المحاولة.');
  return {...result.data,email:auth.user.email??'',loginPhone:auth.user.phone??'',personalPhone:typeof auth.user.user_metadata?.phone==='string'?auth.user.user_metadata.phone:''};
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
export type PersonalAccount=Awaited<ReturnType<typeof readPersonalAccount>>;
export async function invalidatePersonalAccount(owner:string){
 await Promise.all([invalidateLocalCache(`customer-profile:${owner}`),invalidateLocalCache(`merchant-account:${owner}`)]);
}
export async function savePersonalAccount(owner:string,base:PersonalAccount,draft:PersonalDraft){
 const values=personalValues(draft),snapshot=Object.freeze({...values});
 if(saving.has(owner))throw Error('يجري حفظ بيانات هذا الحساب.');saving.add(owner);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  if(base.id!==owner)throw Error('تغير الحساب. أعد فتح الصفحة.');
  const session=await assertAccount(owner),db=boundClient(session.access_token);
  let confirmed=false;
  try{
   const r=await db.from('profiles').update(snapshot).eq('id',owner).eq('updated_at',base.updated_at).select(columns).abortSignal(controller.signal).maybeSingle();
   await assertAccount(owner);
   confirmed=!r.error&&!!r.data&&samePersonal(r.data,snapshot);
  }catch{await assertAccount(owner);}
  const current=await readPersonalAccount(owner);
  if(!samePersonal(current,snapshot))throw Error(confirmed?'حُفظت البيانات ثم تغيرت. أعد تحميل الحساب.':'تعذر تأكيد الحفظ أو تغيرت البيانات. تحقق من السجل قبل إعادة الحفظ.');
  await invalidatePersonalAccount(owner);return current;
 }finally{clearTimeout(timeout);saving.delete(owner);}
}
let logoutBusy=false;
export async function logoutPersonalAccount(owner:string){
 if(logoutBusy)throw Error('يجري تسجيل الخروج.');logoutBusy=true;
 let sent=false;
 try{
  await assertAccount(owner);
  let pushTimer:ReturnType<typeof setTimeout>|undefined;
  await Promise.race([disablePushDevice(owner).catch(()=>undefined),new Promise<void>(resolve=>{pushTimer=setTimeout(resolve,1500);})]).finally(()=>clearTimeout(pushTimer));
  await assertAccount(owner);
  const operation=supabase.auth.signOut({scope:'local'});sent=true;
  void operation.finally(()=>{logoutBusy=false;}).catch(()=>{});
  const {error}=await deadline(operation);
  const after=await supabase.auth.getSession();
  if(after.error)throw Error('تعذر تأكيد حالة الجلسة. أعد التحقق.');
  if(after.data.session?.user.id&&after.data.session.user.id!==owner)return false;
  if(error&&after.data.session)throw Error('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا.');
  await invalidatePersonalAccount(owner);return !after.data.session;
 }finally{if(!sent)logoutBusy=false;}
}
const passwordSaving=new Set<string>();
export async function changePersonalPassword(owner:string,email:string,currentPassword:string,password:string){
 if(password.length<8||password===currentPassword)throw Error('اختر كلمة مرور جديدة من 8 أحرف على الأقل.');
 if(passwordSaving.has(owner))throw Error('يجري تغيير كلمة المرور.');passwordSaving.add(owner);
 try{
 await assertAccount(owner);
 // Verification must never replace the app's shared session with another login.
 const isolated=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!,process.env.EXPO_PUBLIC_SUPABASE_KEY!,{global:{fetch:accountFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'account-password-ephemeral'}});
 try{
  const verified=await deadline(isolated.auth.signInWithPassword({email,password:currentPassword}));
  await assertAccount(owner);
  if(verified.error||verified.data.user?.id!==owner)throw Error('تعذر التحقق من كلمة المرور الحالية.');
  const result=await deadline(isolated.auth.updateUser({password}));
  await assertAccount(owner);
  if(result.error)throw Error('تعذر تأكيد تغيير كلمة المرور. لا تُعِد المحاولة قبل التحقق من إمكانية الدخول.');
 }finally{await deadline(isolated.auth.signOut({scope:'local'})).catch(()=>{});}
 }finally{passwordSaving.delete(owner);}
}
