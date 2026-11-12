import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'expo-router';
import {StyleSheet,Text,View} from 'react-native';
import {AccountShell} from '@/components/account/AccountShell';
import {AppHeader} from '@/components/navigation/AppHeader';
import {AppTextField} from '@/components/ui/AppTextField';
import {AppButton} from '@/components/ui/AppButton';
import {AccountSection} from '@/components/account/AccountSection';
import {AccountLoadState} from '@/components/account/SharedAccountParts';
import {usePersonalAccount} from '@/hooks/usePersonalAccount';
import {useAccountDraftGuard} from '@/hooks/useAccountDraftGuard';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {accountHome} from '@/lib/personal-account-model';
import {changePersonalPassword} from '@/lib/personal-account';
import {KeyboardAwareScrollView} from '@/components/ui/KeyboardAwareScrollView';
import {AppIcon} from '@/components/ui/AppIcon';
import {MaxContentWidth,Radius,Spacing,Typography} from '@/constants/theme';
export default function SecurityScreen({embedded=false,keyboardOffset=0}:{embedded?:boolean;keyboardOffset?:number}={}){
 const {user}=useAuth();return <SecurityOwner key={user?.id??'none'} embedded={embedded} keyboardOffset={keyboardOffset}/>;
}
function SecurityOwner({embedded,keyboardOffset}:{embedded:boolean;keyboardOffset:number}){
 const account=usePersonalAccount(),router=useRouter(),{colors}=useTheme(),{user}=useAuth();
 const [currentPassword,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [fieldErrors,setFieldErrors]=useState<{current?:string;next?:string;confirmation?:string}>({});
 const profile=embedded && (account.data?.role!=='merchant'||account.data.id!==user?.id)?null:account.data;
 const lock=useRef(false),scope=useRef(user?.id),alive=useRef(true);useEffect(()=>{scope.current=user?.id;},[user?.id]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const leave=useCallback(()=>{if(router.canGoBack())router.back();else router.replace(embedded?'/merchant/account':profile?accountHome[profile.role]:'/');},[router,embedded,profile]);
 const guard=useAccountDraftGuard(!!(currentPassword||password||confirmation),busy,leave,()=>lock.current);
 const change=async()=>{
  if(lock.current||!profile||!user||embedded&&!profile.email)return;
  if(!currentPassword||password.length<8||password!==confirmation||password===currentPassword){
   setNotice('');
   if(embedded){
    setError('');
    setFieldErrors({
     current:!currentPassword?'أدخل كلمة المرور الحالية.':undefined,
     next:password.length<8?'استخدم 8 أحرف على الأقل.':password===currentPassword?'اختر كلمة مرور مختلفة عن الحالية.':undefined,
     confirmation:!confirmation||password!==confirmation?'أعد كتابة كلمة المرور الجديدة للتأكيد.':undefined,
    });
   }else setError('أدخل كلمة المرور الحالية وكلمة جديدة مختلفة من 8 أحرف على الأقل، مع تأكيد مطابق.');
   return;
  }
  setFieldErrors({});
  const owner=user.id,email=profile.email,snapshot={currentPassword,password};
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{await changePersonalPassword(owner,email,snapshot.currentPassword,snapshot.password);if(alive.current&&scope.current===owner){setCurrent('');setPassword('');setConfirmation('');setNotice('تم تغيير كلمة المرور. قد تحتاج إلى تسجيل الدخول مجددًا عند انتهاء الجلسة.');}}
  catch{if(alive.current&&scope.current===owner)setError('تعذر التحقق من العملية. تحقق من كلمة المرور الحالية والاتصال؛ إذا انقطع الرد بعد الإرسال، تحقق من الدخول قبل إعادة المحاولة.');}
  finally{lock.current=false;if(alive.current&&scope.current===owner)setBusy(false);}
 };
 if(embedded){
  const clearFeedback=()=>{setFieldErrors({});setError('');setNotice('');};
  return <>
   <KeyboardAwareScrollView style={{backgroundColor:colors.background}} contentContainerStyle={merchantStyles.content} showsVerticalScrollIndicator={false}>
    <View style={[merchantStyles.identity,{backgroundColor:colors.surfaceSecondary}]}>
     <View style={[merchantStyles.icon,{backgroundColor:colors.surfaceSelected}]}><AppIcon name="lock-closed-outline" size={21} color={colors.primary}/></View>
     <View style={merchantStyles.identityText}>
      <Text style={[merchantStyles.caption,{color:colors.textSecondary}]}>بريد الدخول</Text>
      <Text selectable style={[merchantStyles.email,{color:colors.text}]}>{profile?.email || (account.loading?'جارٍ تحميل الحساب…':'غير متاح')}</Text>
     </View>
    </View>
    {account.error?<View style={merchantStyles.stack}>
     <Text accessibilityRole="alert" style={[merchantStyles.body,{color:colors.errorForeground}]}>{profile?'تعذر تحديث الحساب. تظهر آخر بيانات متاحة.':'تعذر تحميل بيانات الحساب.'}</Text>
     <View style={merchantStyles.actions}><AppButton compact fullWidth={false} title="إعادة المحاولة" variant="outline" disabled={busy} onPress={()=>void account.reload()}/></View>
    </View>:null}
    {profile?.email?<View style={[merchantStyles.form,{borderColor:colors.borderSubtle}]}>
     <Text accessibilityRole="header" style={[Typography.cardTitle,merchantStyles.right,{color:colors.text}]}>تغيير كلمة المرور</Text>
     <AppTextField label="كلمة المرور الحالية" value={currentPassword} onChangeText={value=>{setCurrent(value);clearFeedback();}} secureTextEntry passwordToggleMode="icon" disabled={busy} autoComplete="current-password" autoCapitalize="none" error={fieldErrors.current}/>
     <AppTextField label="كلمة المرور الجديدة" value={password} onChangeText={value=>{setPassword(value);clearFeedback();}} secureTextEntry passwordToggleMode="icon" disabled={busy} autoComplete="new-password" autoCapitalize="none" helperText="8 أحرف على الأقل" error={fieldErrors.next}/>
     <AppTextField label="تأكيد كلمة المرور الجديدة" value={confirmation} onChangeText={value=>{setConfirmation(value);clearFeedback();}} secureTextEntry passwordToggleMode="icon" disabled={busy} autoComplete="new-password" autoCapitalize="none" error={fieldErrors.confirmation}/>
    </View>:!account.loading&&!account.error?<Text accessibilityRole="alert" style={[merchantStyles.body,{color:colors.errorForeground}]}>تعذر تحديد بريد الدخول لهذا الحساب. أعد فتح الصفحة بعد التحقق من جلستك.</Text>:null}
    {error?<Text accessibilityRole="alert" style={[merchantStyles.body,{color:colors.errorForeground}]}>{error}</Text>:null}
    {notice?<Text accessibilityLiveRegion="polite" style={[merchantStyles.body,{color:colors.successForeground}]}>{notice}</Text>:null}
    <View style={merchantStyles.actions}>
     {profile?.email?<AppButton compact fullWidth={false} icon="checkmark-outline" title="تغيير كلمة المرور" loading={busy} onPress={()=>void change()}/>:null}
     <AppButton compact fullWidth={false} title="العودة" variant="outline" disabled={busy} onPress={guard.back}/>
    </View>
   </KeyboardAwareScrollView>
   {guard.modal}
  </>;
 }
 const text={...Typography.body,color:colors.text,textAlign:'right' as const};
 return <><AccountShell header={embedded?null:<AppHeader title="الأمان وكلمة المرور" showNotifications={false} mode={account.data?.role==='customer'?'shared':account.data?'business':'shared'} showBack onBack={guard.back}/>} safeBottom={!embedded} keyboardAware keyboardVerticalOffset={embedded?keyboardOffset:undefined}>
 <AccountLoadState loading={account.loading} error={account.error} retry={()=>void account.reload()}/>
 {account.data?<AccountSection title="تغيير كلمة المرور"><View style={{padding:16,gap:12}}>
 <Text selectable style={text}>بريد الدخول: {account.data.email||'غير متاح'} (للعرض فقط)</Text>
 <AppTextField design="refined" label="كلمة المرور الحالية" value={currentPassword} onChangeText={setCurrent} secureTextEntry disabled={busy} autoComplete="current-password"/>
 <AppTextField design="refined" label="كلمة المرور الجديدة" value={password} onChangeText={setPassword} secureTextEntry disabled={busy} autoComplete="new-password"/>
 <AppTextField design="refined" label="تأكيد كلمة المرور الجديدة" value={confirmation} onChangeText={setConfirmation} secureTextEntry disabled={busy} autoComplete="new-password"/>
 {error?<Text accessibilityRole="alert" style={{...text,color:colors.errorForeground}}>{error}</Text>:null}{notice?<Text accessibilityRole="alert" style={{...text,color:colors.successForeground}}>{notice}</Text>:null}
 <Text style={{...text,color:colors.textSecondary}}>لا تُحفظ كلمات المرور في الجهاز. التحقق يجري بجلسة مؤقتة مستقلة عن جلسة التطبيق.</Text>
 <AppButton design="refined" title="تغيير كلمة المرور" loading={busy} onPress={()=>void change()}/>
 <AppButton design="refined" title="العودة" variant="outline" disabled={busy} onPress={guard.back}/>
 </View></AccountSection>:null}
 </AccountShell>{guard.modal}</>;
}

const merchantStyles=StyleSheet.create({
 content:{width:'100%',maxWidth:MaxContentWidth,alignSelf:'center',padding:Spacing.four,gap:Spacing.three},
 identity:{flexDirection:'row-reverse',alignItems:'center',gap:Spacing.three,padding:Spacing.three,borderRadius:Radius.lg},
 identityText:{flex:1,minWidth:0,gap:Spacing.half},
 icon:{width:44,height:44,borderRadius:Radius.md,alignItems:'center',justifyContent:'center'},
 form:{gap:Spacing.two,borderTopWidth:StyleSheet.hairlineWidth,paddingTop:Spacing.three},
 stack:{gap:Spacing.one},actions:{flexDirection:'row-reverse',flexWrap:'wrap',alignItems:'center',gap:Spacing.two},
 right:{textAlign:'right'},body:{...Typography.body,textAlign:'right'},caption:{...Typography.caption,textAlign:'right'},
 email:{...Typography.bodyStrong,textAlign:'right',writingDirection:'ltr'},
});
