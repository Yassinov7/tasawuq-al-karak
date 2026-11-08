import {useRef,useState,useEffect} from 'react';
import {useRouter,type Href} from 'expo-router';
import {ActivityIndicator,Text,View} from 'react-native';
import {AccountProfileHeader} from '@/components/account/AccountProfileHeader';
import {AccountSection} from '@/components/account/AccountSection';
import {AccountMenuItem} from '@/components/account/AccountMenuItem';
import {AppButton} from '@/components/ui/AppButton';
import {AppConfirmModal} from '@/components/ui/AppModal';
import {useTheme} from '@/context/ThemeContext';
import {useAuth} from '@/context/AuthContext';
import {usePersonalAccount} from '@/hooks/usePersonalAccount';
import {logoutPersonalAccount} from '@/lib/personal-account';
import {accountLabel,type AccountRole} from '@/lib/personal-account-model';
import {Typography} from '@/constants/theme';
export function AccountLoadState({loading,error,retry}:{loading:boolean;error:string;retry:()=>void}){
 const {colors}=useTheme();return <View style={{gap:8}}>{loading?<ActivityIndicator color={colors.primary}/>:null}{error?<><Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text><AppButton design="refined" title="إعادة المحاولة" variant="outline" onPress={retry}/></>:null}</View>;
}
export function SharedAccountIdentity({expectedRole}:{expectedRole:AccountRole}){
 const state=usePersonalAccount(),router=useRouter();
 return <><AccountLoadState loading={state.loading} error={state.error} retry={()=>void state.reload()}/>{state.data?.role===expectedRole?<AccountProfileHeader name={state.data.full_name} roleBadge={accountLabel[state.data.role]} showStatusIndicator={false} details={[{icon:'mail-outline',value:state.data.email||'البريد غير متاح'}]} onEdit={()=>router.push(expectedRole==='merchant'?'/merchant/personal-info':('/personal-info' as Href))}/>:null}</>;
}
export function SharedAccountMenu({role}:{role:AccountRole}){
 const router=useRouter();return <AccountSection title="إدارة الحساب"><AccountMenuItem title="المعلومات الشخصية" subtitle="الاسم والبيانات الشخصية الاختيارية" icon="person-outline" onPress={()=>router.push(role==='merchant'?'/merchant/personal-info':('/personal-info' as Href))}/><AccountMenuItem title="الإعدادات" icon="settings-outline" onPress={()=>router.push(role==='merchant'?'/merchant/settings':'/settings')}/><AccountMenuItem title="الأمان وكلمة المرور" icon="lock-closed-outline" isLast onPress={()=>router.push(role==='merchant'?'/merchant/security':'/security')}/></AccountSection>;
}
export function AccountLogout(){const {user}=useAuth();return <LogoutOwner key={user?.id??'none'} owner={user?.id}/>;}
function LogoutOwner({owner}:{owner?:string}){
 const router=useRouter(),{colors}=useTheme();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const logout=async()=>{if(!owner||lock.current)return;lock.current=true;setBusy(true);setError('');try{const signedOut=await logoutPersonalAccount(owner);if(signedOut)router.replace('/login');}catch{if(alive.current)setError('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا.');}finally{lock.current=false;if(alive.current)setBusy(false);}};
 return <><AppButton design="refined" title="تسجيل الخروج" variant="outline" disabled={!owner} loading={busy} onPress={()=>setOpen(true)}/>{error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}<AppConfirmModal design="refined" visible={open} title="تسجيل الخروج؟" message="هل تريد إنهاء جلستك على هذا الجهاز؟" busy={busy} destructive onCancel={()=>{if(!lock.current)setOpen(false);}} onConfirm={()=>void logout()}/></>;
}
