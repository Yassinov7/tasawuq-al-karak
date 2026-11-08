import {useCallback,useRef,useState} from 'react';
import {useFocusEffect,useRouter} from 'expo-router';
import {Text,View} from 'react-native';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {getDriverApplication,type DriverApplication} from '@/lib/driver-deliveries';
import {assertAccount,deadline} from '@/lib/personal-account';
import {AccountSection} from '@/components/account/AccountSection';
import {AccountLoadState} from '@/components/account/SharedAccountParts';
import {Typography} from '@/constants/theme';
export function DriverProfessionalInfo(){
 const {user}=useAuth(),owner=user?.id,router=useRouter(),{colors}=useTheme(),seq=useRef(0),focused=useRef(false);
 const [state,setState]=useState<{owner?:string;data:DriverApplication|null;loading:boolean;error:string}>({data:null,loading:true,error:''});
 const load=useCallback(async()=>{const token=++seq.current;if(!owner)return;setState(p=>({owner,data:p.owner===owner?p.data:null,loading:true,error:''}));try{
  await assertAccount(owner);const data=await deadline(getDriverApplication(owner));await assertAccount(owner);
  if(focused.current&&seq.current===token){if(!data||data.status!=='accepted'){setState({owner,data:null,loading:false,error:'لا يتوفر اعتماد سائق فعال لهذا الحساب.'});router.replace('/application-status');return;}setState({owner,data,loading:false,error:''});}
 }catch{if(focused.current&&seq.current===token)setState(p=>({owner,data:p.owner===owner?p.data:null,loading:false,error:'تعذر تحميل بيانات الاعتماد. أعد المحاولة.'}));}},[owner,router]);
 useFocusEffect(useCallback(()=>{focused.current=true;void load();return()=>{focused.current=false;seq.current++;};},[load]));
 const data=state.owner===owner?state.data:null;
 const hours=data?.available_hours;
 const schedule=hours&&typeof hours==='object'&&!Array.isArray(hours)&&typeof hours.schedule==='string'?hours.schedule:'غير محددة';
 return <AccountSection title="بيانات اعتماد السائق" subtitle="بيانات مهنية للعرض فقط؛ لا يغيرها محرر المعلومات الشخصية."><View style={{padding:16,gap:8}}>
 <AccountLoadState loading={state.owner!==owner||state.loading} error={state.owner===owner?state.error:''} retry={()=>void load()}/>
 {data?([['الاسم في طلب الاعتماد',data.full_name],['حالة الاعتماد',data.status==='accepted'?'معتمد':'غير معتمد'],['هاتف السائق المهني',data.contact_phone],['المركبة',data.vehicle_type],['أوقات التوفر المسجلة',schedule]] as const).map(([label,value])=><View key={label} style={{gap:4}}><Text style={{...Typography.body,color:colors.textSecondary,textAlign:'right'}}>{label}</Text><Text selectable style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>{value}</Text></View>):null}
 </View></AccountSection>;
}
