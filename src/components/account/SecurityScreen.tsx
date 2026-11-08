import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'expo-router';
import {Text,View} from 'react-native';
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
import {Typography} from '@/constants/theme';
export default function SecurityScreen({embedded=false,keyboardOffset=0}:{embedded?:boolean;keyboardOffset?:number}={}){
 const {user}=useAuth();return <SecurityOwner key={user?.id??'none'} embedded={embedded} keyboardOffset={keyboardOffset}/>;
}
function SecurityOwner({embedded,keyboardOffset}:{embedded:boolean;keyboardOffset:number}){
 const account=usePersonalAccount(),router=useRouter(),{colors}=useTheme(),{user}=useAuth();
 const [currentPassword,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false),scope=useRef(user?.id),alive=useRef(true);useEffect(()=>{scope.current=user?.id;},[user?.id]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const leave=useCallback(()=>{if(router.canGoBack())router.back();else router.replace(account.data?accountHome[account.data.role]:'/');},[router,account.data]);
 const guard=useAccountDraftGuard(!!(currentPassword||password||confirmation),busy,leave,()=>lock.current);
 const change=async()=>{
  if(lock.current||!account.data||!user)return;
  if(!currentPassword||password.length<8||password!==confirmation||password===currentPassword){setError('أدخل كلمة المرور الحالية وكلمة جديدة مختلفة من 8 أحرف على الأقل، مع تأكيد مطابق.');return;}
  const owner=user.id,email=account.data.email,snapshot={currentPassword,password};
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{await changePersonalPassword(owner,email,snapshot.currentPassword,snapshot.password);if(alive.current&&scope.current===owner){setCurrent('');setPassword('');setConfirmation('');setNotice('تم تغيير كلمة المرور. قد تحتاج إلى تسجيل الدخول مجددًا عند انتهاء الجلسة.');}}
  catch{if(alive.current&&scope.current===owner)setError('تعذر التحقق من العملية. تحقق من كلمة المرور الحالية والاتصال؛ إذا انقطع الرد بعد الإرسال، تحقق من الدخول قبل إعادة المحاولة.');}
  finally{lock.current=false;if(alive.current&&scope.current===owner)setBusy(false);}
 };
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
