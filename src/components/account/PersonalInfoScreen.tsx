import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'expo-router';
import {StyleSheet,Text,View} from 'react-native';
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
import {KeyboardAwareScrollView} from '@/components/ui/KeyboardAwareScrollView';
import {MaxContentWidth,Radius,Spacing,Typography} from '@/constants/theme';
export function PersonalInfoScreen({embedded=false,keyboardOffset=0}:{embedded?:boolean;keyboardOffset?:number}){
 const {user}=useAuth();return <PersonalInfoOwner key={user?.id??'none'} embedded={embedded} keyboardOffset={keyboardOffset}/>;
}
function PersonalInfoOwner({embedded,keyboardOffset}:{embedded:boolean;keyboardOffset:number}){
 const state=usePersonalAccount();
 const data=embedded&&state.data?.role!=='merchant'?null:state.data;
 return data?<PersonalForm initial={data} embedded={embedded} keyboardOffset={keyboardOffset} readError={state.error} retry={()=>void state.reload()}/>:<AccountShell header={embedded?null:<AppHeader title="المعلومات الشخصية" showBack mode="shared"/>}><AccountLoadState loading={state.loading} error={state.error} retry={()=>void state.reload()}/></AccountShell>;
}
function PersonalForm({initial,embedded,keyboardOffset,readError,retry}:{initial:PersonalAccount;embedded:boolean;keyboardOffset:number;readError:string;retry:()=>void}){
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
 const nameField=<AppTextField design="refined" label="الاسم الكامل" value={draft.full_name} maxLength={120} editable={!busy&&!uncertain} onChangeText={full_name=>setDraft(p=>({...p,full_name}))}/>;
 const feedback=<>{error?<Text accessibilityRole="alert" style={{...Typography.body,textAlign:'right',color:colors.errorForeground}}>{error}</Text>:null}{notice?<Text accessibilityLiveRegion="polite" style={{...Typography.body,textAlign:'right',color:colors.successForeground}}>{notice}</Text>:null}</>;
 if(embedded)return <>
  <KeyboardAwareScrollView style={{backgroundColor:colors.background}} contentContainerStyle={merchantStyles.content} showsVerticalScrollIndicator={false}>
   <MerchantPersonalSection title="الاسم" editable>
    {nameField}
   </MerchantPersonalSection>
   <MerchantPersonalSection title="بيانات الحساب">
    <MerchantPersonalValue label="تاريخ الميلاد" value={base.birth_date ?? "غير مسجل"}/>
    <MerchantPersonalValue label="بريد الدخول" value={base.email || "غير متاح"}/>
    <MerchantPersonalValue label="هاتف الدخول" value={base.loginPhone || "غير مسجل"}/>
    {base.personalPhone?<MerchantPersonalValue label="هاتف الملف غير الموثق" value={base.personalPhone}/>:null}
   </MerchantPersonalSection>
   {readError?<View style={merchantStyles.stack}>
    <Text accessibilityRole="alert" style={[merchantStyles.hint,{color:colors.errorForeground}]}>تعذر تحديث بيانات الحساب. تظهر آخر بيانات متاحة.</Text>
    <View style={merchantStyles.actions}><AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" disabled={busy} onPress={retry}/></View>
   </View>:null}
   {feedback}
   <View style={merchantStyles.actions}>
    <AppButton compact fullWidth={false} icon={uncertain?'search-outline':'checkmark-outline'} title={uncertain?'التحقق من الحفظ':'حفظ الاسم'} disabled={!uncertain&&!dirty} loading={busy} onPress={()=>void (uncertain?verify():save())}/>
    <AppButton compact fullWidth={false} title="العودة" variant="outline" disabled={busy} onPress={guard.back}/>
   </View>
  </KeyboardAwareScrollView>
  {guard.modal}
 </>;
 const text={...Typography.body,color:colors.text,textAlign:'right' as const};
 return <><AccountShell header={embedded?null:<AppHeader title="المعلومات الشخصية" showBack onBack={guard.back} showNotifications={false} mode={base.role==='customer'?'shared':'business'}/>} safeBottom={!embedded} keyboardAware keyboardVerticalOffset={embedded?keyboardOffset:undefined}>
 <AccountSection title="بياناتك الشخصية"><View style={{padding:16,gap:12}}>
 {nameField}
 <Text style={text}>تاريخ الميلاد: {base.birth_date ?? "غير مسجل"}</Text>
 <Text selectable style={text}>بريد الدخول: {base.email||'غير متاح'} (للعرض فقط)</Text>
 <Text selectable style={text}>هاتف الدخول: {base.loginPhone||'غير مسجل'} (للعرض فقط)</Text>
 {base.personalPhone?<Text selectable style={text}>هاتف الملف غير الموثق: {base.personalPhone} (للعرض فقط)</Text>:null}
 <Text style={{...text,color:colors.textSecondary}}>بيانات التواصل المهنية والمتجر واعتماد السائق مستقلة عن هذه المعلومات.</Text>
 {feedback}
 {uncertain?<AppButton design="refined" title="التحقق من نتيجة الحفظ" loading={busy} onPress={()=>void verify()}/>:<AppButton design="refined" title="حفظ المعلومات الشخصية" disabled={!dirty} loading={busy} onPress={()=>void save()}/>}
 <AppButton design="refined" title="إلغاء والعودة" variant="outline" disabled={busy} onPress={guard.back}/>
 </View></AccountSection></AccountShell>{guard.modal}</>;
}


function MerchantPersonalSection({title,editable=false,children}:{title:string;editable?:boolean;children:ReactNode}){
 const {colors}=useTheme();
 return <View style={[merchantStyles.section,{borderColor:colors.borderSubtle}]}>
  <View style={merchantStyles.heading}>
   <Text accessibilityRole="header" style={[Typography.cardTitle,{color:colors.text,textAlign:'right'}]}>{title}</Text>
   {editable?null:<Text style={[merchantStyles.hint,{color:colors.textSecondary}]}>للعرض فقط</Text>}
  </View>
  {editable?children:<View style={[merchantStyles.readOnly,{backgroundColor:colors.surfaceSecondary}]}>{children}</View>}
 </View>;
}

function MerchantPersonalValue({label,value}:{label:string;value:string}){
 const {colors}=useTheme();
 return <View style={[merchantStyles.valueRow,{borderColor:colors.borderSubtle}]}>
  <Text style={[merchantStyles.hint,{color:colors.textSecondary}]}>{label}</Text>
  <Text selectable style={[merchantStyles.value,{color:colors.text}]}>{value}</Text>
 </View>;
}

const merchantStyles=StyleSheet.create({
 content:{width:'100%',maxWidth:MaxContentWidth,alignSelf:'center',padding:Spacing.four,gap:Spacing.four},
 section:{gap:Spacing.two,borderBottomWidth:StyleSheet.hairlineWidth,paddingBottom:Spacing.three},
 heading:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:Spacing.two},
 hint:{...Typography.caption,textAlign:'right'},stack:{gap:Spacing.one},
 readOnly:{borderRadius:Radius.md,paddingHorizontal:Spacing.three},
 valueRow:{gap:Spacing.half,borderBottomWidth:StyleSheet.hairlineWidth,paddingVertical:Spacing.two},
 value:{...Typography.body,textAlign:'right',writingDirection:'auto'},
 actions:{flexDirection:'row-reverse',alignItems:'center',flexWrap:'wrap',gap:Spacing.two},
});
