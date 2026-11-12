import {MerchantSubscriptionScreen} from '@/components/merchant/MerchantAccountScreens';
import {SubscriptionAccountPanel} from '@/components/merchant/SubscriptionAccountPanel';
import {AccountShell} from '@/components/account/AccountShell';
export default function MerchantPage(){return <AccountShell header={null}><SubscriptionAccountPanel legacyContent={<MerchantSubscriptionScreen embedded/>}/></AccountShell>;}
