import type {ReactNode} from 'react';
import {ActivityIndicator,FlatList,KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {formatCompactOfferDate} from '@/lib/offer-expiration';
import {AppButton} from '@/components/ui/AppButton';
import {AppTextField} from '@/components/ui/AppTextField';
import {OfferExpirationPicker} from '@/components/merchant/OfferExpirationPicker';
import {useTheme} from '@/context/ThemeContext';
import {Radius,Spacing,Typography} from '@/constants/theme';
import {formatSyp} from '@/lib/money';
import {displayOfferMoney,type OfferErrors,type OfferForm,type OfferPreview,type OfferProduct,type OfferRole,type OfferType} from '@/lib/merchant-offer-editor';
export const offerTypeLabels:Record<OfferType,string>={discount:'تخفيض',bundle:'حزمة',buy_x_get_y:'اشترِ واحصل'};
const roleLabels:Record<OfferRole,string>={discounted:'منتج مشمول بالتخفيض',bundle:'مكون الحزمة',buy:'منتج الشراء',reward:'المكافأة'};
export type OfferSection = 'identity' | 'pricing' | 'products' | 'period';
export type OfferPickerState={open:boolean;role:OfferRole;query:string;rows:OfferProduct[];loading:boolean;moreLoading:boolean;hasMore:boolean;error:string};
export const emptyOfferPicker:OfferPickerState={open:false,role:'discounted',query:'',rows:[],loading:false,moreLoading:false,hasMore:false,error:''};
type Props={onSectionLayout:(section:OfferSection,y:number)=>void;availabilityError:boolean;refreshAvailability:()=>void;form:OfferForm;products:OfferProduct[];errors:OfferErrors;preview:OfferPreview|null;startsAt?:string;now:number;locked:boolean;busy:boolean;pending:boolean;confirmed:boolean;
 change:<K extends keyof OfferForm>(key:K,value:OfferForm[K])=>void;changeType:(type:OfferType)=>void;openPicker:(role:OfferRole)=>void;remove:(key:string)=>void;quantity:(key:string,value:string)=>void;save:()=>void;cancel:()=>void;
 picker:OfferPickerState;pickerQuery:(value:string)=>void;pickerMore:()=>void;pickerRetry:()=>void;pickerClose:()=>void;choose:(product:OfferProduct)=>void};
export function MerchantOfferForm(props:Props){
 const {colors}=useTheme();const{form,errors,locked}=props;
 const productById = new Map(props.products.map(product => [product.id, product]));
 const issue=(key:string)=>errors[key]?<Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{errors[key]}</Text>:null;
 return<>
  <Section title="بيانات العرض" onLayout={y=>props.onSectionLayout('identity',y)}>
   <AppTextField design="refined" label="اسم العرض" value={form.title} onChangeText={value=>props.change('title',value)} maxLength={140} disabled={locked} error={errors.title}/>
   <AppTextField design="refined" label="الوصف (اختياري)" value={form.description} onChangeText={value=>props.change('description',value)} maxLength={5000} multiline disabled={locked} error={errors.description}/>
  </Section>
  <Section title="نوع العرض والسعر" onLayout={y=>props.onSectionLayout('pricing',y)}>
   <View style={styles.row}>{(Object.keys(offerTypeLabels) as OfferType[]).map(type=><Choice key={type} label={offerTypeLabels[type]} selected={form.type===type} disabled={locked} onPress={()=>props.changeType(type)}/>)}</View>{issue('type')}
   {form.type==='discount'?<>
    <View style={styles.row}><Choice label="نسبة مئوية" selected={form.discountMethod==='percentage'} disabled={locked} onPress={()=>props.change('discountMethod','percentage')}/><Choice label="مبلغ لكل وحدة" selected={form.discountMethod==='fixed_amount'} disabled={locked} onPress={()=>props.change('discountMethod','fixed_amount')}/></View>
    <AppTextField design="refined" label={form.discountMethod==='percentage'?'نسبة الخصم (٪)':'الخصم لكل وحدة (ل.س)'} value={form.discountValue} onChangeText={value=>props.change('discountValue',value)} keyboardType="decimal-pad" disabled={locked} error={errors.discountValue}/>
   </>:form.type==='bundle'?<AppTextField design="refined" label="سعر الحزمة (ل.س)" value={form.bundlePrice} onChangeText={value=>props.change('bundlePrice',value)} keyboardType="decimal-pad" disabled={locked} error={errors.bundlePrice}/>:<Text style={[styles.body,{color:colors.textSecondary}]}>مكون شراء واحد ومكافأة واحدة. يمكن استخدام المنتج نفسه للدورين وفق الكميات المسموحة.</Text>}
  </Section>
  <Section title="مكونات العرض" onLayout={y=>props.onSectionLayout('products',y)}>
   <View style={styles.row}>
    {form.type==='buy_x_get_y'?<>
      <AppButton compact fullWidth={false} icon="add-outline" title="منتج الشراء" variant="outline" disabled={locked} onPress={()=>props.openPicker('buy')}/>
      <AppButton compact fullWidth={false} icon="gift-outline" title="المكافأة" variant="outline" disabled={locked} onPress={()=>props.openPicker('reward')}/>
    </>:<AppButton compact fullWidth={false} icon="add-outline" title="اختيار المنتجات" variant="outline" disabled={locked} onPress={()=>props.openPicker(form.type==='bundle'?'bundle':'discounted')}/>}
   </View>
   {issue('items')}
   {props.availabilityError || form.items.some(item=>!productById.get(item.productId)?.is_available)?<View style={styles.row}>
    {props.availabilityError?<Text style={[styles.body,styles.grow,{color:colors.warningForeground}]}>تعذر تحديث توفر المنتجات.</Text>:null}
    <AppButton compact fullWidth={false} icon="refresh-outline" title="تحديث التوفر" variant="outline" disabled={locked} onPress={props.refreshAvailability}/>
   </View>:null}
   {!form.items.length?<Text style={[styles.body,{color:colors.textSecondary}]}>اختر منتجات من متجرك لإضافتها إلى العرض.</Text>:null}
   {form.items.map(item=>{
    const product=productById.get(item.productId);
    return <View key={item.key} style={[styles.component,{borderColor:colors.borderSubtle}]}>
      <View style={styles.row}>
        <View style={styles.productInfo}>
          <Text style={[styles.strong,{color:colors.text}]}>{product?.title??'منتج لم يعد متاحًا'}</Text>
          {form.type==='buy_x_get_y'?<Text style={[styles.body,{color:colors.textSecondary}]}>{roleLabels[item.role]}</Text>:null}
          {product?<Text style={[styles.body,{color:colors.textSecondary}]}>{formatSyp(product.price)} لكل {product.selling_unit}</Text>:null}
        </View>
        <AppButton compact fullWidth={false} icon="trash-outline" title="إزالة" accessibilityLabel={`إزالة ${product?.title??roleLabels[item.role]}`} variant="outline" disabled={locked} onPress={()=>props.remove(item.key)}/>
      </View>
      {!product?.is_available&&!errors[item.key]?<Text style={[styles.body,{color:colors.warningForeground}]}>غير متاح حاليًا. أزله أو استبدله قبل الحفظ.</Text>:null}
      <View style={styles.row}>
        <View style={styles.quantity}>
          <AppTextField design="refined" label={product?`الكمية (${product.selling_unit})`:'الكمية'} value={item.quantity} onChangeText={value=>props.quantity(item.key,value)} keyboardType="decimal-pad" disabled={locked} error={errors[item.key]}/>
        </View>
        {product?<Text style={[styles.body,styles.quantityHint,{color:colors.textSecondary}]}>الحد الأدنى {product.minimum_quantity} · خطوة البيع {product.quantity_step}</Text>:null}
      </View>
    </View>;
   })}
   {props.preview?<View style={[styles.summary,{backgroundColor:colors.surfaceSecondary}]}>
    <Text style={[styles.strong,{color:colors.text}]}>معاينة حسب الأسعار الحالية</Text>
    <Amount label="قبل العرض" value={displayOfferMoney(props.preview.original)}/>
    <Amount label="التوفير" value={displayOfferMoney(props.preview.saving)}/>
    <Amount label="بعد العرض" value={displayOfferMoney(props.preview.final)}/>
   </View>:null}
  </Section>
  <Section title="فترة العرض والتفعيل" onLayout={y=>props.onSectionLayout('period',y)}>
   <View style={styles.row}><Text style={[styles.strong,styles.grow,{color:colors.text}]}>{form.active?'العرض مفعّل':'العرض متوقف'}</Text><Switch accessibilityLabel="تفعيل العرض" disabled={locked} value={form.active} onValueChange={value=>props.change('active',value)} trackColor={{false:colors.borderStrong,true:colors.primaryLight}} thumbColor={form.active?colors.primary:colors.surface}/></View>
   <Amount label="البداية" value={props.startsAt ? formatCompactOfferDate(props.startsAt) ?? 'غير متاحة' : 'عند إنشاء العرض'} date={Boolean(props.startsAt)}/>
   <OfferExpirationPicker mode={form.endMode} original={form.originalEndsAt} date={form.endDate} time={form.endTime} selectedInstant={form.selectedEndInstant} now={props.now} startsAt={props.startsAt} disabled={locked} error={errors.end}
    onSelect={selection=>{
     if(selection.mode==='new'){props.change('endDate',selection.date);props.change('endTime',selection.time);props.change('selectedEndInstant',selection.instant);}
     props.change('endMode',selection.mode);
    }}/>
  </Section>
  <View style={styles.actions}>
   <AppButton design="refined" title={props.confirmed?'تم الحفظ؛ العودة إلى العروض':props.pending?'التحقق من نتيجة الحفظ':'حفظ العرض'} loading={props.busy} disabled={locked&&!props.pending&&!props.confirmed} onPress={props.save}/>
   <AppButton compact fullWidth={false} title="إلغاء" variant="outline" disabled={props.busy} onPress={props.cancel}/>
  </View>
  <OfferProductPicker state={props.picker} selected={form.items.filter(item=>item.role===props.picker.role).map(item=>item.productId)} query={props.pickerQuery} more={props.pickerMore} retry={props.pickerRetry} close={props.pickerClose} choose={props.choose} disabled={locked}/>
 </>;
}
function OfferProductPicker({state,selected,query,more,retry,close,choose,disabled}:{state:OfferPickerState;selected:string[];query:(value:string)=>void;more:()=>void;retry:()=>void;close:()=>void;choose:(product:OfferProduct)=>void;disabled:boolean}){
 const{colors}=useTheme(),insets=useSafeAreaInsets();
 return<Modal visible={state.open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent><View style={{flex:1,paddingHorizontal:16,paddingTop:insets.top+12,paddingBottom:insets.bottom+12,justifyContent:'center',backgroundColor:colors.overlayScrim}}>
  <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,maxHeight:'90%',width:'100%',maxWidth:600,alignSelf:'center'}}><View style={[styles.picker,{backgroundColor:colors.surface,borderColor:colors.borderStrong}]}>
   <View style={styles.row}>
    <Text accessibilityRole="header" style={[Typography.cardTitle,styles.grow,styles.right,{color:colors.text}]}>{state.role==='buy'||state.role==='reward'?roleLabels[state.role]:'منتجات متجرك'}</Text>
    <AppButton compact fullWidth={false} title="تم" variant="outline" onPress={close}/>
   </View>
   <View style={styles.row}><View style={styles.grow}><AppTextField design="refined" label="ابحث باسم المنتج" value={state.query} onChangeText={query} disabled={disabled}/></View>
    {state.query?<AppButton compact fullWidth={false} icon="close-outline" title="مسح" accessibilityLabel="مسح البحث" disabled={disabled} onPress={()=>query('')}/>:null}
   </View>
   {state.error?<><Text style={[styles.body,{color:colors.errorForeground}]}>{state.error}</Text><AppButton design="refined" title="إعادة المحاولة" variant="outline" onPress={retry}/></>:null}
   <FlatList data={state.rows} keyExtractor={item=>item.id} keyboardShouldPersistTaps="handled" onEndReachedThreshold={0.4} onEndReached={more}
    ListEmptyComponent={state.loading?<ActivityIndicator color={colors.primary}/>:state.error?null:<Text style={[styles.body,{color:colors.textSecondary}]}>{state.query ? 'لا توجد نتائج متاحة لهذا البحث.' : 'لا توجد منتجات متاحة لإضافتها.'}</Text>}
    ListFooterComponent={state.moreLoading?<ActivityIndicator color={colors.primary}/>:state.hasMore?<AppButton design="refined" title="تحميل المزيد" variant="outline" disabled={state.loading||disabled} onPress={more}/>:null}
    renderItem={({item})=><Pressable accessibilityRole="button" accessibilityState={{selected:selected.includes(item.id),disabled}} disabled={disabled} onPress={()=>choose(item)} style={[styles.option,{backgroundColor:selected.includes(item.id)?colors.surfaceSelected:colors.surface,borderColor:colors.borderSubtle}]}><Text style={[styles.strong,{color:colors.text}]}>{selected.includes(item.id)?'✓ ':''}{item.title}</Text><Text style={[styles.body,{color:colors.textSecondary}]}>{formatSyp(item.price)} / {item.selling_unit} · من {item.minimum_quantity} بخطوة {item.quantity_step}</Text></Pressable>}/>

  </View></KeyboardAvoidingView>
 </View></Modal>;
}
function Section({title,children,onLayout}:{title:string;children:ReactNode;onLayout:(y:number)=>void}){const{colors}=useTheme();return<View onLayout={event=>onLayout(event.nativeEvent.layout.y)} style={[styles.section,{borderColor:colors.borderSubtle}]}><Text accessibilityRole="header" style={[Typography.cardTitle,styles.right,{color:colors.text}]}>{title}</Text>{children}</View>;}
function Choice({label,selected,onPress,disabled}:{label:string;selected:boolean;onPress:()=>void;disabled:boolean}){const{colors}=useTheme();return<Pressable accessibilityRole="radio" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[styles.choice,{backgroundColor:selected?colors.surfaceSelected:colors.surface,borderColor:selected?colors.primary:colors.borderStrong}]}><Text style={[styles.strong,{color:disabled?colors.disabledForeground:selected?colors.primary:colors.text}]}>{label}</Text></Pressable>;}
function Amount({label,value,date=false}:{label:string;value:string;date?:boolean}){const{colors}=useTheme();return<View style={styles.row}><Text style={[styles.body,{color:colors.textSecondary}]}>{label}</Text><Text style={[styles.strong,date&&styles.date,{color:colors.text}]}>{value}</Text></View>;}
const styles=StyleSheet.create({section:{paddingVertical:Spacing.three,gap:Spacing.two,borderBottomWidth:StyleSheet.hairlineWidth},row:{flexDirection:'row-reverse',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:Spacing.two},grow:{flexGrow:1,flexShrink:1,flexBasis:140},body:{...Typography.body,textAlign:'right'},strong:{...Typography.bodyStrong,textAlign:'right'},right:{textAlign:'right'},choice:{minHeight:44,padding:Spacing.two,borderWidth:1,borderRadius:Radius.md,justifyContent:'center',flexGrow:1},component:{borderTopWidth:StyleSheet.hairlineWidth,paddingTop:Spacing.two,gap:Spacing.one},productInfo:{flex:1,minWidth:130},quantity:{flexGrow:1,flexBasis:120,maxWidth:240},quantityHint:{flexGrow:1,flexShrink:1,flexBasis:145},summary:{padding:Spacing.two,gap:Spacing.one,borderRadius:Radius.md},actions:{gap:Spacing.one,alignItems:"center"},date:{writingDirection:"ltr",fontVariant:["tabular-nums"]},picker:{flex:1,padding:Spacing.three,gap:Spacing.two,borderWidth:1,borderRadius:Radius.lg},option:{minHeight:56,padding:Spacing.three,borderBottomWidth:1,gap:Spacing.one}});
