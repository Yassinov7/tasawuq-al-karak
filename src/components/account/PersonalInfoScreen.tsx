import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'expo-router';
import {Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {usePersonalAccount} from '@/hooks/usePersonalAccount';
import {useAccountDraftGuard} from '@/hooks/useAccountDraftGuard';
import {AccountShell} from '@/components/account/AccountShell';
import {AccountSection} from '@/components/account/AccountSection';
import {AccountLoadState} from '@/components/account/SharedAccountParts';
import {AppHeader} from '@/components/navigation/AppHeader';
import {AppTextField} from '@/components/ui/AppTextField';
import {AppButton} from '@/components/ui/AppButton';
import {personalSaveResolution,personalDraft,personalValues,samePersonal,accountHome,type PersonalDraft} from '@/lib/personal-account-model';
import {readPersonalAccount,savePersonalAccount,type PersonalAccount} from '@/lib/personal-account';
import {Typography} from '@/constants/theme';
export function PersonalInfoScreen({embedded=false,keyboardOffset=0}:{embedded?:boolean;keyboardOffset?:number}){
 const {user}=useAuth();return <PersonalInfoOwner key={user?.id??'none'} embedded={embedded} keyboardOffset={keyboardOffset}/>;
}
function PersonalInfoOwner({embedded,keyboardOffset}:{embedded:boolean;keyboardOffset:number}){
 const state=usePersonalAccount();
 return state.data?<PersonalForm initial={state.data} embedded={embedded} keyboardOffset={keyboardOffset}/>:<AccountShell header={embedded?null:<AppHeader title="المعلومات الشخصية" showBack mode="shared"/>}><AccountLoadState loading={state.loading} error={state.error} retry={()=>void state.reload()}/></AccountShell>;
}
function PersonalForm({initial,embedded,keyboardOffset}:{initial:PersonalAccount;embedded:boolean;keyboardOffset:number}){
 const router=useRouter(),{colors}=useTheme(),{user}=useAuth();
 const [base,setBase]=useState(initial),[draft,setDraft]=useState<PersonalDraft>(()=>personalDraft(initial)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false);
 const lock=useRef(false),alive=useRef(true),owner=initial.id,current=useRef(user?.id);useEffect(()=>{current.current=user?.id;},[user?.id]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const active=()=>alive.current&&current.current===owner;
 const leave=useCallback(()=>{if(router.canGoBack())router.back();else router.replace(accountHome[base.role]);},[router,base.role]);
 const dirty=!samePersonal(draft,base),guard=useAccountDraftGuard(dirty,busy,leave,()=>lock.current);
 const save=async()=>{
  if(lock.current||uncertain)return;
  try{personalValues(draft);}catch(e){setError(e instanceof Error?e.message:'راجع البيانات.');return;}
  lock.current=true;setBusy(true);setError('');setNotice('');const snapshot={...draft};
  try{const result=await savePersonalAccount(owner,base,snapshot);if(active()){setBase(result);setDraft(personalDraft(result));setNotice('تم حفظ المعلومات الشخصية.');}}
  catch{if(active()){setUncertain(true);setError('تعذر تأكيد الحفظ. احتُفظ بتعديلاتك؛ تحقق من النتيجة قبل أي إرسال جديد.');}}
  finally{lock.current=false;if(active())setBusy(false);}
 };
 const verify=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{const result=await readPersonalAccount(owner);if(!active())return;if(personalSaveResolution(result,draft,base)==='confirmed'){setBase(result);setDraft(personalDraft(result));setUncertain(false);setError('');setNotice('تأكد حفظ المعلومات الشخصية.');}else if(personalSaveResolution(result,draft,base)==='retry'){setBase(result);setUncertain(false);setError('تأكدنا أن القيم المحفوظة ما زالت السابقة. راجع مسودتك ثم اضغط حفظ إذا أردت إعادة المحاولة.');}else setError('تغيرت البيانات المحفوظة من جلسة أخرى. احتفظنا بمسودتك؛ ارجع دون حفظ لإعادة تحميل أحدث القيم.');}catch{if(active())setError('تعذر التحقق. لم تُمسح المسودة ولم نكرر الحفظ.');}finally{lock.current=false;if(active())setBusy(false);}};
 const text={...Typography.body,color:colors.text,textAlign:'right' as const};
 return <><AccountShell header={embedded?null:<AppHeader title="المعلومات الشخصية" showBack onBack={guard.back} showNotifications={false} mode={base.role==='customer'?'shared':'business'}/>} safeBottom={!embedded} keyboardAware keyboardVerticalOffset={embedded?keyboardOffset:undefined}>
 <AccountSection title="بياناتك الشخصية"><View style={{padding:16,gap:12}}>
 <AppTextField design="refined" label="الاسم الكامل" value={draft.full_name} maxLength={120} editable={!busy&&!uncertain} onChangeText={full_name=>setDraft(p=>({...p,full_name}))}/>
 <Text style={text}>الفئة العمرية (اختياري)</Text><View style={{flexDirection:'row-reverse',flexWrap:'wrap',gap:8}}>{([[null,'غير محددة'],['under_18','أقل من 18'],['18_24','18–24'],['25_34','25–34'],['35_44','35–44'],['45_54','45–54'],['55_plus','55 فأكثر']] as const).map(([value,label])=><AppButton design="refined" fullWidth={false} key={value??'none'} title={label} disabled={busy||uncertain} variant={draft.age_range===value?'primary':'outline'} onPress={()=>setDraft(p=>({...p,age_range:value}))}/>)}</View>
 <Text style={text}>الجنس (اختياري)</Text><View style={{flexDirection:'row-reverse',flexWrap:'wrap',gap:8}}>{([[null,'غير محدد'],['male','ذكر'],['female','أنثى'],['prefer_not_to_say','أفضل عدم الإجابة']] as const).map(([value,label])=><AppButton design="refined" fullWidth={false} key={value??'none'} title={label} disabled={busy||uncertain} variant={draft.gender===value?'primary':'outline'} onPress={()=>setDraft(p=>({...p,gender:value}))}/>)}</View>
 <Text selectable style={text}>بريد الدخول: {base.email||'غير متاح'} (للعرض فقط)</Text>
 <Text selectable style={text}>هاتف الدخول: {base.loginPhone||'غير مسجل'} (للعرض فقط)</Text>
 {base.personalPhone?<Text selectable style={text}>هاتف الملف غير الموثق: {base.personalPhone} (للعرض فقط)</Text>:null}
 <Text style={{...text,color:colors.textSecondary}}>بيانات التواصل المهنية والمتجر واعتماد السائق مستقلة عن هذه المعلومات.</Text>
 {error?<Text accessibilityRole="alert" style={{...text,color:colors.errorForeground}}>{error}</Text>:null}{notice?<Text accessibilityRole="alert" style={{...text,color:colors.successForeground}}>{notice}</Text>:null}
 {uncertain?<AppButton design="refined" title="التحقق من نتيجة الحفظ" loading={busy} onPress={()=>void verify()}/>:<AppButton design="refined" title="حفظ المعلومات الشخصية" disabled={!dirty} loading={busy} onPress={()=>void save()}/>}
 <AppButton design="refined" title="إلغاء والعودة" variant="outline" disabled={busy} onPress={guard.back}/>
 </View></AccountSection></AccountShell>{guard.modal}</>;
}
