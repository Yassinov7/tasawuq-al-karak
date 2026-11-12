import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { useTheme } from '@/context/ThemeContext';
import { Radius, Typography } from '@/constants/theme';
import { localOfferFields, moveOfferMonth, offerCalendarCells, parseOfferDay } from '@/lib/offer-expiration';
const pad = (n: number) => String(n).padStart(2, '0');
function label(value: string) { const p = parseOfferDay(value); const d = new Date(0); d.setUTCFullYear(p.year, p.month - 1, p.day); return d.toLocaleDateString('ar-SY', { timeZone: 'UTC', calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric' }); }
export function FinancialDatePicker({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <><AppButton design="refined" title={`${title}: ${value ? label(value) : 'أي تاريخ'}`} variant="outline" onPress={() => setOpen(true)} />{open ? <Calendar title={title} value={value} close={() => setOpen(false)} commit={day => { onChange(day); setOpen(false); }} /> : null}</>;
}
function Calendar({ title, value, close, commit }: { title: string; value: string; close: () => void; commit: (day: string) => void }) {
  const { colors } = useTheme();
  const [date, setDate] = useState(value);
  const [month, setMonth] = useState(() => value ? parseOfferDay(value) : localOfferFields(Date.now()));
  const [panel, setPanel] = useState<'days' | 'months' | 'years'>('days');
  const [yearPage, setYearPage] = useState(Math.max(1, month.year - 5));
  const monthName = (year: number, number: number) => label(`${String(year).padStart(4,'0')}-${pad(number)}-01`).replace(/[٠-٩\d]/g, '').trim();
  const choice = (text: string, action: () => void, key: string | number, selected = false) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }} onPress={action} style={[styles.choice, { borderColor: selected ? colors.primary : colors.borderStrong, backgroundColor: selected ? colors.surfaceSelected : colors.surface }]}><Text style={[styles.text, { color: selected ? colors.primary : colors.text }]}>{text}</Text></Pressable>;
  return <AppModal design="refined" visible title={title} message="اختر يومًا بالتوقيت المحلي للجهاز." cancelText="إلغاء" confirmText="اعتماد اليوم" onCancel={close} onConfirm={() => { if (date) commit(date); }}>
    <View style={styles.stack}><View style={styles.row}>
      {choice('الشهر السابق', () => setMonth(previous => ({ ...previous, ...moveOfferMonth(previous.year,previous.month,-1) })), 'previous')}
      {choice(monthName(month.year,month.month), () => setPanel('months'), 'month')}
      {choice(month.year.toLocaleString('ar-SY',{useGrouping:false}), () => { setYearPage(Math.max(1,month.year-5)); setPanel('years'); }, 'year')}
      {choice('الشهر التالي', () => setMonth(previous => ({ ...previous, ...moveOfferMonth(previous.year,previous.month,1) })), 'next')}
    </View>
    {panel === 'days' ? <><View style={styles.days}>{['س','ح','ن','ث','ر','خ','ج'].map((day,index) => <Text key={index} style={[styles.day,styles.text,{color:colors.textSecondary}]}>{day}</Text>)}</View><View style={styles.days}>{offerCalendarCells(month.year,month.month).map((day,index) => {
      if (!day) return <View key={`empty-${index}`} style={styles.day} />;
      const selected = `${String(month.year).padStart(4,'0')}-${pad(month.month)}-${pad(day)}`;
      return <Pressable key={day} accessibilityRole="button" accessibilityLabel={label(selected)} accessibilityState={{selected:date===selected}} onPress={() => setDate(selected)} style={[styles.day,{backgroundColor:date===selected?colors.surfaceSelected:colors.surface}]}><Text style={[styles.text,{color:date===selected?colors.primary:colors.text}]}>{day.toLocaleString('ar-SY')}</Text></Pressable>;
    })}</View></> : <>
      {panel === 'years' ? <View style={styles.row}>{choice('سنوات سابقة',()=>setYearPage(previous=>Math.max(1,previous-12)),'back')}{choice('سنوات لاحقة',()=>setYearPage(previous=>Math.min(9988,previous+12)),'forward')}</View> : null}
      <View style={styles.row}>{Array.from({length:12},(_,index)=>panel==='years'?yearPage+index:index+1).map(number=>choice(panel==='years'?number.toLocaleString('ar-SY',{useGrouping:false}):monthName(month.year,number),()=>{setMonth(previous=>({...previous,[panel==='years'?'year':'month']:number}));setPanel('days');},number))}</View>
    </>}
    <Text style={[styles.text,{color:colors.text}]}>{date ? label(date) : 'اختر اليوم قبل الاعتماد.'}</Text>
    <AppButton design="refined" title="إزالة حد التاريخ" variant="outline" onPress={() => commit('')} />
    </View>
  </AppModal>;
}
const styles=StyleSheet.create({stack:{gap:12},row:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},choice:{minHeight:48,minWidth:44,padding:8,borderWidth:1,borderRadius:Radius.md,justifyContent:'center',flexGrow:1},text:{...Typography.body,textAlign:'center'},days:{flexDirection:'row-reverse',flexWrap:'wrap'},day:{width:'14.285714%',minHeight:48,justifyContent:'center',textAlignVertical:'center'}});
