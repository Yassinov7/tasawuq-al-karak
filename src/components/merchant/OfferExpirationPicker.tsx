import{useState}from'react';
import{Pressable,StyleSheet,Text,View}from'react-native';
import{AppButton}from'@/components/ui/AppButton';
import{AppModal}from'@/components/ui/AppModal';
import{useTheme}from'@/context/ThemeContext';
import{Radius,Spacing,Typography}from'@/constants/theme';
import{formatCompactOfferDate,keepsSavedOfferEnd,localOfferEndInstant,localOfferFields,moveOfferMonth,offerCalendarCells,parseOfferDay,validateLocalOfferEnd}from'@/lib/offer-expiration';
type Selection={mode:'keep'|'none'}|{mode:'new';date:string;time:string;instant:string};
type Props={mode:'keep'|'none'|'new';original:string|null;date:string;time:string;selectedInstant?:string;now:number;startsAt?:string;disabled:boolean;error?:string;onSelect:(value:Selection)=>void};
type Draft={date:string;hour:number|null;minute:number|null;year:number;month:number;yearPage:number;panel:'calendar'|'months'|'years'|'hours'|'minutes'};
const pad=(value:number)=>String(value).padStart(2,'0');
const arabic=(value:number)=>value.toLocaleString('ar-SY',{useGrouping:false});
const weekdays=['س','ح','ن','ث','ر','خ','ج'];
function monthLabel(year:number,month:number){const value=new Date(0);value.setUTCFullYear(year,month-1,1);return value.toLocaleString('ar-SY',{calendar:'gregory',month:'long',timeZone:'UTC'});}
function seed(props:Props):Draft{
 const current=localOfferFields(props.now);let date='',hour:number|null=null,minute:number|null=null,year=current.year,month=current.month;
 if(props.mode==='keep'&&props.original){const saved=localOfferFields(props.original);date=saved.date;hour=saved.hour;minute=saved.minute;year=saved.year;month=saved.month;}
 else if(props.mode==='new'){
  try{const saved=parseOfferDay(props.date);date=props.date;year=saved.year;month=saved.month;}catch{/* No date selected yet. */}
  if(/^\d{2}:\d{2}$/.test(props.time)){const parts=props.time.split(':').map(Number);if(parts[0]<24&&parts[1]<60){hour=parts[0];minute=parts[1];}}
 }
 return{date,hour,minute,year,month,yearPage:Math.max(1,year-5),panel:'calendar'};
}
export function OfferExpirationPicker(props:Props){
 const{colors}=useTheme();const[open,setOpen]=useState(false);
 let displayed:string|null=null;
 if(props.mode==='keep')displayed=props.original;
 else if(props.mode==='new'){try{displayed=props.selectedInstant??localOfferEndInstant(props.date,props.time);}catch{/* Validation is shown alongside the field. */}}
 return<View style={styles.stack}>
  <Text style={[styles.strong,{color:colors.text}]}>موعد انتهاء العرض</Text>
  <Text style={[styles.body,displayed&&styles.date,{color:colors.text}]}>{props.mode==='none'?'بدون تاريخ انتهاء':displayed?formatCompactOfferDate(displayed):'لم يُحدَّد موعد كامل بعد'}</Text>
  {props.original&&Date.parse(props.original)<=props.now?<Text style={[styles.body,{color:colors.warningForeground}]}>الموعد المحفوظ منتهٍ. اختر موعدًا مستقبليًا جديدًا أو «بدون تاريخ انتهاء» صراحةً.</Text>:null}
  {props.mode==='new'&&props.original?<Text style={[styles.body,{color:colors.textSecondary}]}>المحفوظ سابقًا: {formatCompactOfferDate(props.original)}</Text>:null}
  <AppButton design="refined" title={displayed?'تعديل الموعد':'اختيار موعد الانتهاء'} variant="outline" disabled={props.disabled} onPress={()=>setOpen(true)}/>
  <View style={styles.row}>
   <Choice label="بدون تاريخ انتهاء" selected={props.mode==='none'} disabled={props.disabled} onPress={()=>props.onSelect({mode:'none'})}/>
   {props.original?<Choice label="إبقاء الموعد المحفوظ" selected={props.mode==='keep'} disabled={props.disabled} onPress={()=>props.onSelect({mode:'keep'})}/>:null}
  </View>
  {props.error?<Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{props.error}</Text>:null}
  {open?<ExpirationDialog {...props} close={()=>setOpen(false)} commit={value=>{if(!props.disabled){props.onSelect(value);setOpen(false);}}}/>:null}
 </View>;
}
function ExpirationDialog(props:Props&{close:()=>void;commit:(value:Selection)=>void}){
 const{colors}=useTheme();
 // Dialog is mounted on open; parent rerenders never reset the in-progress selection.
 const[draft,setDraft]=useState(()=>seed(props)),[error,setError]=useState('');
 const update=(patch:Partial<Draft>)=>{setDraft(previous=>({...previous,...patch}));setError('');};
 const changeMonth=(delta:number)=>update(moveOfferMonth(draft.year,draft.month,delta));
 const select=(value:number)=>{
  if(draft.panel==='months')update({month:value,panel:'calendar'});
  else if(draft.panel==='years')update({year:value,panel:'calendar'});
  else if(draft.panel==='hours')update({hour:value,panel:'calendar'});
  else if(draft.panel==='minutes')update({minute:value,panel:'calendar'});
 };
 const confirm=()=>{
  if(props.disabled)return;
  try{
   if(!draft.date)throw new Error('اختر يوم الانتهاء من التقويم.');
   if(draft.hour===null||draft.minute===null)throw new Error('اختر الساعة والدقيقة لإكمال موعد الانتهاء.');
   const time=`${pad(draft.hour)}:${pad(draft.minute)}`;
   if(props.mode==='keep'&&keepsSavedOfferEnd(props.original,draft.date,time)){
    if(!props.original||Date.parse(props.original)<=Date.now())throw new Error('الموعد المحفوظ مضى؛ اختر موعدًا مستقبليًا أو بدون تاريخ انتهاء.');
    if(props.startsAt&&Date.parse(props.original)<=Date.parse(props.startsAt))throw new Error('يجب أن يكون الموعد بعد بداية العرض.');
    props.commit({mode:'keep'});return;
   }
   const instant=validateLocalOfferEnd(draft.date,time,Date.now(),props.startsAt);
   props.commit({mode:'new',date:draft.date,time,instant});
  }catch(failure){setError(failure instanceof Error?failure.message:'راجع اليوم والوقت المختارين.');}
 };
 const panelValues=draft.panel==='months'?Array.from({length:12},(_,index)=>index+1):draft.panel==='years'?Array.from({length:Math.min(12,10000-draft.yearPage)},(_,index)=>draft.yearPage+index):Array.from({length:draft.panel==='hours'?24:60},(_,index)=>index);
 let selectedDay:number|null=null;
 try{const parts=parseOfferDay(draft.date);if(parts.year===draft.year&&parts.month===draft.month)selectedDay=parts.day;}catch{/* Calendar has no selected date yet. */}
 return<AppModal design="refined" visible title="اختيار موعد الانتهاء" message="اختر اليوم من التقويم، ثم الساعة والدقيقة بتوقيت جهازك." confirmText="تأكيد الموعد" cancelText="إلغاء" onCancel={props.close} onConfirm={confirm}>
  <View style={styles.stack}>
   <View style={styles.row}>
    <Choice label="الشهر السابق" disabled={props.disabled||(draft.year===1&&draft.month===1)} onPress={()=>changeMonth(-1)}/>
    <Choice label={`${monthLabel(draft.year,draft.month)} ▾`} disabled={props.disabled} onPress={()=>update({panel:'months'})}/>
    <Choice label={`${arabic(draft.year)} ▾`} disabled={props.disabled} onPress={()=>update({panel:'years',yearPage:Math.max(1,draft.year-5)})}/>
    <Choice label="الشهر التالي" disabled={props.disabled||(draft.year===9999&&draft.month===12)} onPress={()=>changeMonth(1)}/>
   </View>
   {draft.panel==='calendar'?<>
    <View style={styles.calendar}>{weekdays.map((day,index)=><View key={index} style={styles.dayCell}><Text style={[styles.body,{color:colors.textSecondary,textAlign:'center'}]}>{day}</Text></View>)}</View>
    <View style={styles.calendar}>{offerCalendarCells(draft.year,draft.month).map((day,index)=>day===null?<View key={`blank-${index}`} style={styles.dayCell}/>:<Pressable key={day} accessibilityRole="button" accessibilityLabel={`${arabic(day)} ${monthLabel(draft.year,draft.month)} ${arabic(draft.year)}`} accessibilityState={{selected:day===selectedDay,disabled:props.disabled}} disabled={props.disabled} onPress={()=>update({date:`${String(draft.year).padStart(4,'0')}-${pad(draft.month)}-${pad(day)}`})} style={[styles.dayCell,styles.day,{backgroundColor:day===selectedDay?colors.surfaceSelected:colors.surface,borderColor:day===selectedDay?colors.primary:colors.borderSubtle}]}><Text style={[styles.strong,{color:day===selectedDay?colors.primary:colors.text,textAlign:'center'}]}>{arabic(day)}</Text></Pressable>)}</View>
   </>:<>
    <Text style={[styles.strong,{color:colors.text}]}>{draft.panel==='months'?'اختر الشهر':draft.panel==='years'?'اختر السنة':draft.panel==='hours'?'اختر الساعة — نظام 24 ساعة':'اختر الدقيقة'}</Text>
    {draft.panel==='years'?<View style={styles.row}><Choice label="سنوات سابقة" disabled={draft.yearPage<=1} onPress={()=>update({yearPage:Math.max(1,draft.yearPage-12)})}/><Choice label="سنوات لاحقة" disabled={draft.yearPage+12>9999} onPress={()=>update({yearPage:Math.min(9988,draft.yearPage+12)})}/></View>:null}
    <View style={styles.row}>{panelValues.map(value=><Choice key={value} label={draft.panel==='months'?monthLabel(draft.year,value):draft.panel==='years'?arabic(value):arabic(value).padStart(2,'٠')} selected={draft.panel==='months'?draft.month===value:draft.panel==='years'?draft.year===value:draft.panel==='hours'?draft.hour===value:draft.minute===value} disabled={props.disabled} onPress={()=>select(value)}/>)}</View>
    <AppButton design="refined" title="العودة إلى التقويم" variant="outline" onPress={()=>update({panel:'calendar'})}/>
   </>}
   <View style={styles.row}><Choice label={`الساعة: ${draft.hour===null?'اختر':arabic(draft.hour).padStart(2,'٠')}`} disabled={props.disabled} onPress={()=>update({panel:'hours'})}/><Choice label={`الدقيقة: ${draft.minute===null?'اختر':arabic(draft.minute).padStart(2,'٠')}`} disabled={props.disabled} onPress={()=>update({panel:'minutes'})}/></View>
   <Text style={[styles.body,{color:colors.textSecondary}]}>{draft.date?`اليوم المختار: ${arabic(parseOfferDay(draft.date).day)} ${monthLabel(parseOfferDay(draft.date).year,parseOfferDay(draft.date).month)} ${arabic(parseOfferDay(draft.date).year)}`:'لم تختر يومًا بعد'}{draft.hour!==null&&draft.minute!==null?` · ${arabic(draft.hour).padStart(2,'٠')}:${arabic(draft.minute).padStart(2,'٠')}`:' · اختر الوقت صراحةً'}</Text>
   {error?<Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{error}</Text>:null}
  </View>
 </AppModal>;
}
function Choice({label,onPress,selected=false,disabled=false}:{label:string;onPress:()=>void;selected?:boolean;disabled?:boolean}){
 const{colors}=useTheme();return<Pressable accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[styles.choice,{borderColor:selected?colors.primary:colors.borderStrong,backgroundColor:selected?colors.surfaceSelected:colors.surface}]}><Text style={[styles.strong,{color:disabled?colors.disabledForeground:selected?colors.primary:colors.text,textAlign:'center'}]}>{label}</Text></Pressable>;
}
const styles=StyleSheet.create({date:{writingDirection:"ltr",fontVariant:["tabular-nums"]},stack:{gap:Spacing.two},row:{flexDirection:'row-reverse',flexWrap:'wrap',gap:Spacing.two},body:{...Typography.body,textAlign:'right'},strong:{...Typography.bodyStrong,textAlign:'right'},choice:{minWidth:44,minHeight:48,flexGrow:1,padding:Spacing.two,borderWidth:1,borderRadius:Radius.md,justifyContent:'center'},calendar:{flexDirection:'row-reverse',flexWrap:'wrap'},dayCell:{width:'14.285714%',minHeight:44,justifyContent:'center'},day:{borderWidth:1,borderRadius:Radius.sm,paddingVertical:Spacing.two}});
