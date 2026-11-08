import {useState} from 'react';
import {AppModal} from '@/components/ui/AppModal';
import {useRouter} from 'expo-router';
import {useAuth} from '@/context/AuthContext';
import {AccountShell} from '@/components/account/AccountShell';
import {AccountSection} from '@/components/account/AccountSection';
import {AccountMenuItem} from '@/components/account/AccountMenuItem';
import {SharedAccountIdentity,SharedAccountMenu,AccountLogout} from '@/components/account/SharedAccountParts';
import {DriverProfessionalInfo} from '@/components/account/DriverProfessionalInfo';
import {AppHeader} from '@/components/navigation/AppHeader';
export default function DriverAccountScreen(){const {user}=useAuth();return <DriverAccount key={user?.id??'none'}/>;}
function DriverAccount(){
 const router=useRouter(),[support,setSupport]=useState(false);
 return <><AccountShell header={<AppHeader title="حساب السائق" mode="business"/>}>
 <SharedAccountIdentity expectedRole="driver"/>
 <SharedAccountMenu role="driver"/>
 <DriverProfessionalInfo/>
 <AccountSection title="التوصيل والمساعدة">
 <AccountMenuItem title="حساب التوصيل" subtitle="أجور التوصيل والعهدة النقدية" icon="cash-outline" onPress={()=>router.push('/driver/cash-account')}/>
 <AccountMenuItem title="الإشعارات" icon="notifications-outline" onPress={()=>router.push('/notifications')}/>
 <AccountMenuItem title="الدعم والمساعدة" subtitle="للمساعدة في مهام التوصيل تواصل مع مكتب المنصة." icon="help-circle-outline" onPress={()=>setSupport(true)}/>
 <AccountMenuItem title="عن تسوق" icon="information-circle-outline" isLast onPress={()=>router.push('/about')}/>
 </AccountSection><AccountLogout/>
 </AccountShell><AppModal design="refined" visible={support} title="الدعم والمساعدة" message="تظهر المهام بعد جاهزية طلبات المتاجر. عند قبول مهمة، استخدم توصيلاتي لتأكيد الاستلام والتسليم. للمساعدة تواصل مع مكتب المنصة." onCancel={()=>setSupport(false)}/></>;
}
