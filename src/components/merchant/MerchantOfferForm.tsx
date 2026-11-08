import type {ReactNode} from 'react';
import {ActivityIndicator,FlatList,KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppButton} from '@/components/ui/AppButton';
import {AppTextField} from '@/components/ui/AppTextField';
import {OfferExpirationPicker} from '@/components/merchant/OfferExpirationPicker';
import {useTheme} from '@/context/ThemeContext';
import {Radius,Spacing,Typography} from '@/constants/theme';
import {formatSyp} from '@/lib/money';
import {displayOfferMoney,type OfferErrors,type OfferForm,type OfferPreview,type OfferProduct,type OfferRole,type OfferType} from '@/lib/merchant-offer-editor';
export const offerTypeLabels:Record<OfferType,string>={discount:'تخفيض',bundle:'حزمة',buy_x_get_y:'اشترِ واحصل'};
const roleLabels:Record<OfferRole,string>={discounted:'منتج مشمول بالتخفيض',bundle:'مكون الحزمة',buy:'منتج الشراء',reward:'المكافأة'};
export type OfferPickerState={open:boolean;role:OfferRole;query:string;rows:OfferProduct[];loading:boolean;moreLoading:boolean;hasMore:boolean;error:string};
export const emptyOfferPicker:OfferPickerState={open:false,role:'discounted',query:'',rows:[],loading:false,moreLoading:false,hasMore:false,error:''};
type Props={form:OfferForm;products:OfferProduct[];errors:OfferErrors;preview:OfferPreview|null;startsAt?:string;now:number;locked:boolean;busy:boolean;pending:boolean;confirmed:boolean;
 change:<K extends keyof OfferForm>(key:K,value:OfferForm[K])=>void;changeType:(type:OfferType)=>void;openPicker:(role:OfferRole)=>void;remove:(key:string)=>void;quantity:(key:string,value:string)=>void;save:()=>void;cancel:()=>void;
 picker:OfferPickerState;pickerQuery:(value:string)=>void;pickerMore:()=>void;pickerRetry:()=>void;pickerClose:()=>void;choose:(product:OfferProduct)=>void};
const readable=(value:string)=>new Date(value).toLocaleString('ar-SY',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
export function MerchantOfferForm(props:Props){
 const {colors}=useTheme();const{form,errors,locked}=props;
 const issue=(key:string)=>errors[key]?<Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{errors[key]}</Text>:null;
 return<>
  <Section title="بيانات العرض">
   <AppTextField design="refined" label="عنوان العرض — مطلوب" value={form.title} onChangeText={value=>props.change('title',value)} maxLength={140} disabled={locked} error={errors.title}/>
   <AppTextField design="refined" label="الوصف — اختياري" value={form.description} onChangeText={value=>props.change('description',value)} maxLength={5000} multiline disabled={locked} error={errors.description}/>
  </Section>
  <Section title="نوع العرض وشروطه">
   <View style={styles.row}>{(Object.keys(offerTypeLabels) as OfferType[]).map(type=><Choice key={type} label={offerTypeLabels[type]} selected={form.type===type} disabled={locked} onPress={()=>props.changeType(type)}/>)}</View>{issue('type')}
   {form.type==='discount'?<>
    <View style={styles.row}><Choice label="نسبة مئوية" selected={form.discountMethod==='percentage'} disabled={locked} onPress={()=>props.change('discountMethod','percentage')}/><Choice label="مبلغ لكل وحدة" selected={form.discountMethod==='fixed_amount'} disabled={locked} onPress={()=>props.change('discountMethod','fixed_amount')}/></View>
    <AppTextField design="refined" label={form.discountMethod==='percentage'?'نسبة الخصم ٪ — مطلوبة':'الخصم بالليرة السورية لكل وحدة — مطلوب'} value={form.discountValue} onChangeText={value=>props.change('discountValue',value)} keyboardType="decimal-pad" disabled={locked} error={errors.discountValue}/>
   </>:form.type==='bundle'?<AppTextField design="refined" label="سعر الحزمة بالليرة السورية — مطلوب" value={form.bundlePrice} onChangeText={value=>props.change('bundlePrice',value)} keyboardType="decimal-pad" disabled={locked} error={errors.bundlePrice}/>:<Text style={[styles.body,{color:colors.textSecondary}]}>مكون شراء واحد ومكافأة واحدة. يمكن استخدام المنتج نفسه للدورين وفق الكميات المسموحة.</Text>}
  </Section>
  <Section title="المنتجات والمكونات">
   <Text style={[styles.body,{color:colors.textSecondary}]}>المختار: {form.items.length.toLocaleString('ar-SY')} مكونات. الكميات تخضع للحد الأدنى وخطوة البيع، بما فيها المكافأة.</Text>
   {form.type==='buy_x_get_y'?<View style={styles.row}><View style={styles.grow}><AppButton design="refined" title="اختيار منتج الشراء" variant="outline" disabled={locked} onPress={()=>props.openPicker('buy')}/></View><View style={styles.grow}><AppButton design="refined" title="اختيار المكافأة" variant="outline" disabled={locked} onPress={()=>props.openPicker('reward')}/></View></View>:<AppButton design="refined" title="اختيار المنتجات" variant="outline" disabled={locked} onPress={()=>props.openPicker(form.type==='bundle'?'bundle':'discounted')}/>}
   {issue('items')}
   {!form.items.length?<Text style={[styles.body,{color:colors.textSecondary}]}>لم تختر مكونات بعد. ستبقى اختياراتك هنا مستقلة عن نتائج البحث.</Text>:null}
   {form.items.map(item=>{const product=props.products.find(row=>row.id===item.productId);return<View key={item.key} style={[styles.component,{backgroundColor:colors.surfaceSecondary,borderColor:product?.is_available?colors.borderSubtle:colors.warningBorder}]}>
    <Text style={[styles.strong,{color:colors.text}]}>{product?.title??`منتج غير متاح · ${item.productId}`}</Text>
    <Text style={[styles.body,{color:colors.textSecondary}]}>{roleLabels[item.role]}{product?` · ${formatSyp(product.price)} لكل ${product.selling_unit}`:''}</Text>
    {!product?.is_available?<Text style={[styles.body,{color:colors.warningForeground}]}>غير متاح للاختيار أو الحفظ؛ أزله أو استبدله.</Text>:null}
    <AppTextField design="refined" label={`الكمية${product?` (${product.selling_unit})`:''} — مطلوبة`} value={item.quantity} onChangeText={value=>props.quantity(item.key,value)} keyboardType="decimal-pad" disabled={locked} error={errors[item.key]}/>
    {product?<Text style={[styles.body,{color:colors.textSecondary}]}>الحد الأدنى {product.minimum_quantity} · الخطوة {product.quantity_step}</Text>:null}
    <AppButton design="refined" title="إزالة المكون" variant="outline" disabled={locked} onPress={()=>props.remove(item.key)}/>
   </View>;})}
  </Section>
  <Section title="ملخص السعر">
   <Text style={[styles.body,{color:colors.textSecondary}]}>معاينة وفق أسعار المنتجات الحالية؛ يعيد الخادم التحقق منها عند الطلب. لا تثبّت هذه المعاينة سعر طلب مستقبلي.</Text>
   {props.preview?<><Amount label="المجموع الأصلي" value={displayOfferMoney(props.preview.original)}/><Amount label="التوفير" value={displayOfferMoney(props.preview.saving)}/><Amount label="بعد العرض" value={displayOfferMoney(props.preview.final)}/>
    {form.type==='bundle'?<Text style={[styles.body,{color:colors.infoForeground}]}>يُوزَّع سعر الحزمة عند الطلب وفق ترتيب المكونات المثبت آنذاك. لا نعرض توزيعًا دقيقًا على المنتجات قبل تأكيده.</Text>:null}
   </>:<Text style={[styles.body,{color:colors.textSecondary}]}>أكمل الحقول والمكونات الصالحة لعرض معاينة مؤكدة حسابيًا وفق البيانات المحملة.</Text>}
  </Section>
  <Section title="التفعيل والفترة">
   <View style={styles.row}><Text style={[styles.strong,styles.grow,{color:colors.text}]}>{form.active?'العرض مفعّل':'العرض متوقف'}</Text><Switch disabled={locked} value={form.active} onValueChange={value=>props.change('active',value)} trackColor={{false:colors.borderStrong,true:colors.primaryLight}} thumbColor={form.active?colors.primary:colors.surface}/></View>
   <Text style={[styles.body,{color:colors.textSecondary}]}>{props.startsAt?`البداية المثبتة: ${readable(props.startsAt)}`:'يحدد الخادم البداية عند إنشاء العرض. لا يمكن تغييرها من هذا النموذج.'}</Text>
   <OfferExpirationPicker mode={form.endMode} original={form.originalEndsAt} date={form.endDate} time={form.endTime} selectedInstant={form.selectedEndInstant} now={props.now} startsAt={props.startsAt} disabled={locked} error={errors.end}
    onSelect={selection=>{
     if(selection.mode==='new'){props.change('endDate',selection.date);props.change('endTime',selection.time);props.change('selectedEndInstant',selection.instant);}
     props.change('endMode',selection.mode);
    }}/>
  </Section>
  <Section title="الحفظ والإلغاء">
   <AppButton design="refined" title={props.confirmed?'تم الحفظ؛ العودة إلى العروض':props.pending?'التحقق من نتيجة الحفظ':'حفظ العرض'} loading={props.busy} disabled={locked&&!props.pending&&!props.confirmed} onPress={props.save}/>
   <AppButton design="refined" title="إلغاء والعودة" variant="outline" disabled={props.busy} onPress={props.cancel}/>
  </Section>
  <OfferProductPicker state={props.picker} selected={form.items.filter(item=>item.role===props.picker.role).map(item=>item.productId)} query={props.pickerQuery} more={props.pickerMore} retry={props.pickerRetry} close={props.pickerClose} choose={props.choose} disabled={locked}/>
 </>;
}
function OfferProductPicker({state,selected,query,more,retry,close,choose,disabled}:{state:OfferPickerState;selected:string[];query:(value:string)=>void;more:()=>void;retry:()=>void;close:()=>void;choose:(product:OfferProduct)=>void;disabled:boolean}){
 const{colors}=useTheme(),insets=useSafeAreaInsets();
 return<Modal visible={state.open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent><View style={{flex:1,paddingHorizontal:16,paddingTop:insets.top+12,paddingBottom:insets.bottom+12,justifyContent:'center',backgroundColor:colors.overlayScrim}}>
  <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,maxHeight:'90%',width:'100%',maxWidth:600,alignSelf:'center'}}><View style={[styles.picker,{backgroundColor:colors.surface,borderColor:colors.borderStrong}]}>
   <Text style={[Typography.cardTitle,styles.right,{color:colors.text}]}>{roleLabels[state.role]} — منتجات متاحة من متجرك</Text>
   <AppTextField design="refined" label="البحث باسم المنتج" value={state.query} onChangeText={query} disabled={disabled}/>
   {state.error?<><Text style={[styles.body,{color:colors.errorForeground}]}>{state.error}</Text><AppButton design="refined" title="إعادة المحاولة" variant="outline" onPress={retry}/></>:null}
   <FlatList data={state.rows} keyExtractor={item=>item.id} keyboardShouldPersistTaps="handled" onEndReachedThreshold={0.4} onEndReached={more}
    ListEmptyComponent={state.loading?<ActivityIndicator color={colors.primary}/>:<Text style={[styles.body,{color:colors.textSecondary}]}>لا توجد منتجات مطابقة متاحة. تبقى المكونات المختارة في النموذج.</Text>}
    ListFooterComponent={state.moreLoading?<ActivityIndicator color={colors.primary}/>:state.hasMore?<AppButton design="refined" title="تحميل المزيد" variant="outline" disabled={state.loading||disabled} onPress={more}/>:null}
    renderItem={({item})=><Pressable accessibilityRole="button" accessibilityState={{selected:selected.includes(item.id),disabled}} disabled={disabled} onPress={()=>choose(item)} style={[styles.option,{backgroundColor:selected.includes(item.id)?colors.surfaceSelected:colors.surface,borderColor:colors.borderSubtle}]}><Text style={[styles.strong,{color:colors.text}]}>{selected.includes(item.id)?'✓ ':''}{item.title}</Text><Text style={[styles.body,{color:colors.textSecondary}]}>{formatSyp(item.price)} / {item.selling_unit} · من {item.minimum_quantity} بخطوة {item.quantity_step}</Text></Pressable>}/>
   <AppButton design="refined" title="العودة للمكونات المختارة" variant="outline" onPress={close}/>
  </View></KeyboardAvoidingView>
 </View></Modal>;
}
function Section({title,children}:{title:string;children:ReactNode}){const{colors}=useTheme();return<View style={[styles.section,{backgroundColor:colors.surface,borderColor:colors.borderSubtle}]}><Text style={[Typography.cardTitle,styles.right,{color:colors.text}]}>{title}</Text>{children}</View>;}
function Choice({label,selected,onPress,disabled}:{label:string;selected:boolean;onPress:()=>void;disabled:boolean}){const{colors}=useTheme();return<Pressable accessibilityRole="radio" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[styles.choice,{backgroundColor:selected?colors.surfaceSelected:colors.surface,borderColor:selected?colors.primary:colors.borderStrong}]}><Text style={[styles.strong,{color:disabled?colors.disabledForeground:selected?colors.primary:colors.text}]}>{label}</Text></Pressable>;}
function Amount({label,value}:{label:string;value:string}){const{colors}=useTheme();return<View style={styles.row}><Text style={[styles.body,{color:colors.textSecondary}]}>{label}</Text><Text style={[styles.strong,{color:colors.text}]}>{value}</Text></View>;}
const styles=StyleSheet.create({section:{padding:Spacing.four,gap:Spacing.three,borderWidth:1,borderRadius:Radius.lg},row:{flexDirection:'row-reverse',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:Spacing.two},grow:{flexGrow:1,flexShrink:1,flexBasis:140},body:{...Typography.body,textAlign:'right'},strong:{...Typography.bodyStrong,textAlign:'right'},right:{textAlign:'right'},choice:{minHeight:48,padding:Spacing.three,borderWidth:1,borderRadius:Radius.md,justifyContent:'center',flexGrow:1},component:{borderWidth:1,padding:Spacing.three,borderRadius:Radius.md,gap:Spacing.two},picker:{flex:1,padding:Spacing.three,gap:Spacing.two,borderWidth:1,borderRadius:Radius.lg},option:{minHeight:56,padding:Spacing.three,borderBottomWidth:1,gap:Spacing.one}});
