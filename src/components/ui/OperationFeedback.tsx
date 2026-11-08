import {Text,View} from 'react-native';
import {Typography,Spacing} from '@/constants/theme';
import {useTheme} from '@/context/ThemeContext';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
export function OperationFeedback({state,message}:{state:'completed'|'rejected'|'unknown';message:string}){
 const {colors}=useTheme();return <View accessibilityRole="alert" style={{gap:Spacing.one}}><FinancialStatus label={state==='completed'?'تم التأكيد':state==='rejected'?'رُفضت المحاولة':'نتيجة غير محسومة'} tone={state==='completed'?'success':state==='rejected'?'error':'warning'}/><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{message}</Text></View>;
}
