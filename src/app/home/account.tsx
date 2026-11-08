import {useEffect} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useRouter} from 'expo-router';
import {AccountShell} from '@/components/account/AccountShell';
import {AccountSection} from '@/components/account/AccountSection';
import {AccountMenuItem} from '@/components/account/AccountMenuItem';
import {SharedAccountIdentity,SharedAccountMenu,AccountLogout} from '@/components/account/SharedAccountParts';
import {AppHeader} from '@/components/navigation/AppHeader';
import {useCart} from '@/context/CartContext';
export default function AccountTab(){
 const router=useRouter(),{itemCount}=useCart(),{user,loading}=useAuth();
 useEffect(()=>{if(!loading&&!user)router.replace('/login');},[user,loading,router]);
 return <AccountShell header={<AppHeader title="حسابي" cartCount={itemCount} mode="customer"/>}>
 <SharedAccountIdentity expectedRole="customer"/>
 <AccountSection title="مشترياتي">
 <AccountMenuItem title="طلباتي" icon="receipt-outline" onPress={()=>router.push('/orders')}/>
 <AccountMenuItem title="الفواتير" icon="document-text-outline" onPress={()=>router.push('/invoice')}/>
 <AccountMenuItem title="العناوين" icon="location-outline" onPress={()=>router.push('/addresses')}/>
 <AccountMenuItem title="المفضلة" icon="heart-outline" onPress={()=>router.push('/favorites')}/>
 <AccountMenuItem title="الإشعارات" icon="notifications-outline" isLast onPress={()=>router.push('/notifications')}/>
 </AccountSection><SharedAccountMenu role="customer"/><AccountLogout/>
 </AccountShell>;
}
