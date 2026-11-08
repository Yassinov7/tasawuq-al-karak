import {View,Text} from 'react-native';
import {AppButton} from '@/components/ui/AppButton';
import {OperationFeedback} from '@/components/ui/OperationFeedback';
import {Typography,Spacing} from '@/constants/theme';
import {useTheme} from '@/context/ThemeContext';
export function FinancialOperationControls({busy,error,frozen,result,message,onRecover,onResume,onFinish}:{busy:boolean;error:string;frozen:boolean;result?:{state:'completed'|'rejected'|'unknown'};message:string;onRecover:()=>void;onResume:()=>void;onFinish:()=>void}){
 const {colors}=useTheme();return <View style={{gap:Spacing.two}}>
 {result?<OperationFeedback state={result.state} message={message}/>:null}
 {error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
 {frozen?<Text style={{...Typography.body,color:colors.warningForeground,textAlign:'right'}}>هناك محاولة محفوظة؛ تحقق منها قبل عملية مستقلة.</Text>:null}
 <AppButton design="refined" title="التحقق من المحاولة المحفوظة" variant="outline" disabled={busy} onPress={onRecover}/>
 {frozen?<><AppButton design="refined" title="متابعة المحاولة بالمفتاح نفسه" variant="outline" disabled={busy} onPress={onResume}/><AppButton design="refined" title="بدء عملية مستقلة بعد التحقق" variant="outline" disabled={busy} onPress={onFinish}/></>:null}
 </View>;
}
