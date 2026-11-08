import {Text} from 'react-native';
import {Typography} from '@/constants/theme';
import {useTheme} from '@/context/ThemeContext';
import {parseFinancialReference} from '@/lib/finance-c2-contract';
export function DocumentReference({value}:{value:string}){const {colors}=useTheme();return <Text selectable style={{...Typography.bodyStrong,color:colors.text,textAlign:'right'}}>{parseFinancialReference(value)?value:'مرجع غير صالح'}</Text>;}
