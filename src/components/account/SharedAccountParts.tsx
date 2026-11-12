import {useRef,useState,useEffect} from 'react';
import {useRouter,type Href} from 'expo-router';
import {ActivityIndicator,StyleSheet,Text,View} from 'react-native';
import {AccountProfileHeader} from '@/components/account/AccountProfileHeader';
import {AccountSection} from '@/components/account/AccountSection';
import {AccountMenuItem} from '@/components/account/AccountMenuItem';
import {AppButton} from '@/components/ui/AppButton';
import {AppModal} from '@/components/ui/AppModal';
import {useTheme} from '@/context/ThemeContext';
import {useAuth} from '@/context/AuthContext';
import {usePersonalAccount} from '@/hooks/usePersonalAccount';
import {logoutPersonalAccount} from '@/lib/personal-account';
import {accountLabel,type AccountRole} from '@/lib/personal-account-model';
import {Spacing,Typography} from '@/constants/theme';
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
export function AccountLogout({compact=false}:{compact?:boolean} = {}){const {user}=useAuth();return <LogoutOwner key={user?.id??'none'} owner={user?.id} compact={compact}/>;}
function LogoutOwner({owner,compact}:{owner?:string;compact:boolean}){
 const router=useRouter(),{colors}=useTheme();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const close=()=>{if(!lock.current){setOpen(false);setError('');}};
 const logout=async()=>{
  if(!owner||lock.current)return;
  lock.current=true;setBusy(true);setError('');
  try{
   if(await logoutPersonalAccount(owner))router.replace('/login');
   else if(alive.current)setError('تعذر تأكيد تسجيل الخروج. تحقق من الجلسة وحاول مجددًا.');
  }catch{if(alive.current)setError('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 return <>
  <AppButton design="refined" title="تسجيل الخروج" variant="outline" compact={compact} fullWidth={!compact} icon={compact?'log-out-outline':undefined} disabled={!owner} loading={busy} onPress={()=>{setError('');setOpen(true);}}/>
  <AppModal compact visible={open} icon="log-out-outline" title="تسجيل الخروج؟" message="سيتم إنهاء جلستك على هذا الجهاز." busy={busy} onCancel={close}
   actions={<View style={logoutStyles.actions}>
    <View style={logoutStyles.action}><AppButton title="إلغاء" variant="outline" disabled={busy} onPress={close}/></View>
    <View style={logoutStyles.action}><AppButton title="تسجيل الخروج" variant="danger" loading={busy} onPress={()=>void logout()}/></View>
   </View>}>
   {error?<Text accessibilityRole="alert" style={[logoutStyles.error,{color:colors.errorForeground}]}>{error}</Text>:null}
  </AppModal>
 </>;
}
const logoutStyles=StyleSheet.create({
 actions:{flexDirection:'row-reverse',flexWrap:'wrap',gap:Spacing.two,marginTop:Spacing.three},
 action:{flexGrow:1,flexShrink:1,flexBasis:112,minWidth:0},
 error:{...Typography.caption,textAlign:'center',marginTop:Spacing.two},
});
