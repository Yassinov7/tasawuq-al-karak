import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppTextField } from "@/components/ui/AppTextField";
import { MerchantCategorySelect } from "@/components/merchant/MerchantCategorySelect";
import { SellingUnitSelect } from "@/components/merchant/SellingUnitSelect";
import { ControlSizes, LayoutSpacing, MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { ProductForm } from "@/lib/merchant-product-create";
export type ProductMediaView = {key:string;uri:string;name:string;type:"image"|"video"};
type Props = {
 form:ProductForm; media:ProductMediaView[]; categories:{id:string;name:string;parent_id?:string|null}[]; historicalCategoryName?:string;
 errors:Partial<Record<keyof ProductForm,string>>; locked:boolean; ready:boolean; loading:boolean; picking:boolean; busy:boolean; progress:string;
 change:<K extends keyof ProductForm>(key:K,value:ProductForm[K])=>void;
 onFieldRef:(key:keyof ProductForm,input:TextInput|null)=>void;
 onFirstSectionLayoutY:(value:number)=>void;onCategoryLayoutY:(value:number)=>void;
 onPricingLayoutY:(value:number)=>void;onUnitLayoutY:(value:number)=>void;
 pick:(type:"image"|"video")=>void;onRemoveMedia:(key:string)=>void;
 onSave:()=>void;onCancel:()=>void;saveLabel:string;saveDisabled:boolean;saveError?:string;
};
export function MerchantProductForm({form,media,categories,historicalCategoryName,errors,locked,ready,loading,picking,busy,progress,change,onFieldRef,onFirstSectionLayoutY,onCategoryLayoutY,onPricingLayoutY,onUnitLayoutY,pick,onRemoveMedia,onSave,onCancel,saveLabel,saveDisabled,saveError}:Props) {
 const {colors}=useTheme();const styles=productEditorStyles;
  const field = (key: "title"|"description"|"price"|"minimum"|"step", label: string, extra?: {multiline?:boolean;maxLength?:number;keyboardType?:"decimal-pad"}) => <AppTextField design="refined" label={label} value={form[key]} onChangeText={value=>change(key,value)} disabled={locked || !ready} error={errors[key]} inputRef={input=>onFieldRef(key,input)} {...extra} />;
 const images = media.filter(item => item.type === 'image');
 const hasVideo = media.some(item => item.type === 'video');
 return <>
      <Section title="المعلومات الأساسية" onLayoutY={onFirstSectionLayoutY}>
        {field('title','اسم المنتج',{maxLength:140})}
        <View onLayout={event=>onCategoryLayoutY(event.nativeEvent.layout.y)} style={styles.stack}>
          <Text style={[styles.strong,{color:colors.text}]}>التصنيف</Text>
          <MerchantCategorySelect label="تصنيف المنتج" categories={categories} historicalName={historicalCategoryName} value={form.categoryId} onChange={id=>change('categoryId',id)} disabled={locked || !ready || !categories.length}/>
          {errors.categoryId ? <Text style={[styles.body,{color:colors.errorForeground}]}>{errors.categoryId}</Text> : null}
          {!categories.length && !loading ? <Text style={[styles.body,{color:colors.warningForeground}]}>{historicalCategoryName ? "يمكن إبقاء التصنيف الحالي عند التعديل." : "لا توجد تصنيفات نشطة متاحة."}</Text> : null}
        </View>
        {field('description','الوصف (اختياري)',{multiline:true,maxLength:5000})}
      </Section>
      <Section title="السعر والتوفر" onLayoutY={onPricingLayoutY}>
        {field('price','السعر (ل.س)',{keyboardType:'decimal-pad'})}
        <View style={styles.stack} onLayout={event=>onUnitLayoutY(event.nativeEvent.layout.y)}>
          <SellingUnitSelect value={form.unit} onChange={value=>change('unit',value)} disabled={locked || !ready}/>
          {errors.unit ? <Text accessibilityRole="alert" style={[styles.body,{color:colors.errorForeground}]}>{errors.unit}</Text> : null}
        </View>
        <View style={styles.row}>
          <View style={styles.action}>{field('minimum','أقل كمية',{keyboardType:'decimal-pad'})}</View>
          <View style={styles.action}>{field('step','خطوة الكمية',{keyboardType:'decimal-pad'})}</View>
        </View>
        <Text style={[styles.caption,{color:colors.textSecondary}]}>السعر حتى منزلتين عشريتين والكميات حتى ثلاث. استخدم النقطة أو ٫.</Text>
        <View style={[styles.availability,{backgroundColor:colors.surfaceSecondary}]}>
          <View style={styles.availabilityText}>
            <Text style={[styles.strong,{color:colors.text}]}>{form.available?'متاح للطلب':'غير متاح للطلب'}</Text>
            <Text style={[styles.caption,{color:colors.textSecondary}]}>يُطبّق التوفر عند تأكيد الحفظ، ويعتمد الظهور على حالة المتجر.</Text>
          </View>
          <Switch accessibilityLabel="متاح للطلب" disabled={locked || !ready} value={form.available}
            onValueChange={value=>change('available',value)} trackColor={{false:colors.borderStrong,true:colors.primaryLight}}
            thumbColor={form.available?colors.primary:colors.surface}/>
        </View>
      </Section>
      <Section title="الصور والفيديو (اختياري)">
        <Text style={[styles.caption,{color:colors.textSecondary}]}>حتى ٥ صور وفيديو واحد بمدة تصل إلى دقيقتين. الصورة الأولى تظهر في الكتالوج. الحد ٥٠ MiB لكل ملف.</Text>
        <View style={styles.row}>
          <AppButton compact title="إضافة صور" icon="images-outline" fullWidth={false} variant="outline" disabled={locked || !ready || images.length>=5} onPress={()=>{void pick('image');}}/>
          <AppButton compact title="إضافة فيديو" icon="videocam-outline" fullWidth={false} variant="outline" disabled={locked || !ready || hasVideo} onPress={()=>{void pick('video');}}/>
        </View>
        {picking ? <Text style={[styles.body,{color:colors.infoForeground}]}>جارٍ التحقق من الملفات المختارة…</Text> : null}
        {!media.length ? <Text style={[styles.caption,{color:colors.textSecondary}]}>لا توجد وسائط مضافة.</Text> : null}
        {media.map(item=><View key={item.key} style={[styles.media,{borderBottomColor:colors.border}]}>
          {item.type==='image'?<Image source={{uri:item.uri}} accessibilityLabel={item.name} style={[styles.image,{backgroundColor:colors.surfaceSecondary}]}/>:<AppIcon name="videocam-outline" size={24} color={colors.textSecondary}/>}
          <View style={styles.availabilityText}>
            <Text style={[styles.strong,{color:colors.text}]}>{item.type==='video'?'فيديو':images[0]?.key===item.key?'الصورة الأساسية':'صورة إضافية'}</Text>
            <Text style={[styles.caption,{color:colors.textSecondary}]}>{item.name}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`إزالة ${item.name}`} disabled={locked}
            onPress={()=>onRemoveMedia(item.key)} style={styles.remove}>
            <AppIcon name="trash-outline" size={18} color={locked?colors.disabledForeground:colors.errorForeground}/>
          </Pressable>
        </View>)}
      </Section>
      <View style={[styles.section,{borderTopColor:colors.border}]}>
        {saveError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
          style={[styles.message,{color:colors.errorForeground,backgroundColor:colors.errorSurface,borderColor:colors.errorBorder}]}>{saveError}</Text> : null}
        {progress ? <Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.infoForeground}]}>{progress}</Text>:null}
        <View style={styles.row}>
          <View style={styles.action}><AppButton compact title={saveLabel} icon="checkmark-outline" loading={busy} disabled={saveDisabled} onPress={onSave}/></View>
          <AppButton compact fullWidth={false} title="إلغاء" accessibilityLabel="إلغاء والعودة" variant="outline" disabled={busy || picking} onPress={onCancel}/>
        </View>
      </View>

 </>;
}
function Section({title,children,onLayoutY}:{title:string;children:ReactNode;onLayoutY?:(value:number)=>void}) {
  const {colors}=useTheme();
  return <View onLayout={event=>onLayoutY?.(event.nativeEvent.layout.y)} style={[productEditorStyles.section,{borderTopColor:colors.border}]}><Text accessibilityRole="header" style={[Typography.sectionTitle,productEditorStyles.right,{color:colors.text}]}>{title}</Text>{children}</View>;
}
export const productEditorStyles=StyleSheet.create({
  screen:{flex:1},content:{padding:LayoutSpacing.pageGutter,paddingBottom:Spacing.six,gap:Spacing.three,width:'100%',maxWidth:MaxContentWidth,alignSelf:'center'},
  section:{paddingTop:Spacing.three,gap:Spacing.three,borderTopWidth:StyleSheet.hairlineWidth},stack:{gap:Spacing.one},
  row:{direction:'ltr',flexDirection:'row-reverse',flexWrap:'wrap',alignItems:'center',gap:Spacing.two},action:{flexGrow:1,flexShrink:1,flexBasis:130,minWidth:0},
  caption:{...Typography.caption,textAlign:'right'},
  body:{...Typography.body,textAlign:'right'},strong:{...Typography.bodyStrong,textAlign:'right'},right:{textAlign:'right'},
  status:{gap:Spacing.two,alignItems:'center'},message:{...Typography.body,textAlign:'right',padding:Spacing.three,borderWidth:1,borderRadius:Radius.md,gap:Spacing.two},
  availability:{direction:'ltr',flexDirection:'row-reverse',alignItems:'center',gap:Spacing.two,padding:Spacing.three,borderRadius:Radius.md},
  availabilityText:{flex:1,minWidth:0,gap:Spacing.one},
  media:{direction:'ltr',flexDirection:'row-reverse',alignItems:'center',gap:Spacing.two,paddingBottom:Spacing.two,borderBottomWidth:StyleSheet.hairlineWidth},
  image:{width:64,height:64,resizeMode:'cover',borderRadius:Radius.sm},
  remove:{minHeight:ControlSizes.touch,minWidth:ControlSizes.touch,alignItems:'center',justifyContent:'center'},
});
