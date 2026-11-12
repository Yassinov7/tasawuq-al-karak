import {Text} from 'react-native';
import {Typography} from '@/constants/theme';
import {useTheme} from '@/context/ThemeContext';
const parseFinancialReference=(value:string)=>/^[A-Z]{3}-[0-9]{7,}$/.test(value);
export function DocumentReference({value}:{value:string}){const {colors}=useTheme();return <Text selectable style={{...Typography.bodyStrong,color:colors.text,textAlign:'right',writingDirection:'ltr'}}>{parseFinancialReference(value)?value:'مرجع غير صالح'}</Text>;}
