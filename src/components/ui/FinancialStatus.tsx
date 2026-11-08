import {Text,View} from 'react-native';
import {Typography,Spacing} from '@/constants/theme';
import {useTheme} from '@/context/ThemeContext';
export function FinancialStatus({label,tone='info'}:{label:string;tone?:'success'|'warning'|'error'|'info'}){
 const {colors}=useTheme();const palette={success:[colors.successForeground,colors.successSurface,colors.successBorder],warning:[colors.warningForeground,colors.warningSurface,colors.warningBorder],error:[colors.errorForeground,colors.errorSurface,colors.errorBorder],info:[colors.infoForeground,colors.infoSurface,colors.infoBorder]}[tone];
 return <View style={{alignSelf:'flex-end',paddingHorizontal:Spacing.two,paddingVertical:Spacing.one,borderWidth:1,borderRadius:8,borderColor:palette[2],backgroundColor:palette[1]}}><Text style={{...Typography.bodyStrong,color:palette[0],textAlign:'right'}}>{label}</Text></View>;
}
