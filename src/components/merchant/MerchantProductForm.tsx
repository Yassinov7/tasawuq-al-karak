import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextField } from "@/components/ui/AppTextField";
import { MerchantCategorySelect } from "@/components/merchant/MerchantCategorySelect";
import { SellingUnitSelect } from "@/components/merchant/SellingUnitSelect";
import { LayoutSpacing, MaxContentWidth, Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { ProductForm } from "@/lib/merchant-product-create";
export type ProductMediaView = {key:string;uri:string;name:string;type:"image"|"video"};
type Props = {
 form:ProductForm; media:ProductMediaView[]; categories:{id:string;name:string}[];
 errors:Partial<Record<keyof ProductForm,string>>; locked:boolean; ready:boolean; loading:boolean; picking:boolean; busy:boolean; progress:string;
 change:<K extends keyof ProductForm>(key:K,value:ProductForm[K])=>void;
 onFieldRef:(key:keyof ProductForm,input:TextInput|null)=>void;
 onFirstSectionLayoutY:(value:number)=>void;onCategoryLayoutY:(value:number)=>void;
 pick:(type:"image"|"video")=>void;onRemoveMedia:(key:string)=>void;
 onSave:()=>void;onCancel:()=>void;saveLabel:string;saveDisabled:boolean;
};
export function MerchantProductForm({form,media,categories,errors,locked,ready,loading,picking,busy,progress,change,onFieldRef,onFirstSectionLayoutY,onCategoryLayoutY,pick,onRemoveMedia,onSave,onCancel,saveLabel,saveDisabled}:Props) {
 const {colors}=useTheme();const styles=productEditorStyles;
  const field = (key: "title"|"description"|"price"|"minimum"|"step", label: string, extra?: {multiline?:boolean;maxLength?:number;keyboardType?:"decimal-pad"}) => <AppTextField design="refined" label={label} value={form[key]} onChangeText={value=>change(key,value)} disabled={locked || !ready} error={errors[key]} inputRef={input=>onFieldRef(key,input)} {...extra} />;
 return <>
      <Section title="بيانات المنتج" onLayoutY={onFirstSectionLayoutY}>
        {field('title','اسم المنتج — مطلوب',{maxLength:140})}
        {field('description','الوصف — اختياري',{multiline:true,maxLength:5000})}
        <View onLayout={event=>onCategoryLayoutY(event.nativeEvent.layout.y)} style={styles.stack}>
          <Text style={[styles.strong,{color:colors.text}]}>تصنيف المنتج — مطلوب</Text>
          <MerchantCategorySelect label="تصنيف المنتج" categories={categories} value={form.categoryId} onChange={id=>change('categoryId',id)} disabled={locked || !ready || !categories.length}/>
          {errors.categoryId ? <Text style={[styles.body,{color:colors.errorForeground}]}>{errors.categoryId}</Text> : null}
          {!categories.length && !loading ? <Text style={[styles.body,{color:colors.warningForeground}]}>لا توجد تصنيفات نشطة متاحة. يتعذر الحفظ حتى توفرها.</Text> : null}
        </View>
      </Section>
      <Section title="السعر ووحدة البيع والكميات">
        {field('price','السعر بالليرة السورية — مطلوب',{keyboardType:'decimal-pad'})}
        <SellingUnitSelect value={form.unit} onChange={value=>change('unit',value)} disabled={locked || !ready}/>
        {errors.unit ? <Text style={[styles.body,{color:colors.errorForeground}]}>{errors.unit}</Text> : null}
        {field('minimum','أقل كمية — مطلوب',{keyboardType:'decimal-pad'})}
        {field('step','خطوة الكمية — مطلوب',{keyboardType:'decimal-pad'})}
        <Text style={[styles.body,{color:colors.textSecondary}]}>جميع حقول هذا القسم مطلوبة. السعر حتى منزلتين عشريتين، والكميات حتى ثلاث. استخدم النقطة أو ٫ دون فواصل آلاف. لا يستخدم التطبيق جردًا كميًا للمخزون.</Text>
      </Section>
      <Section title="الصور والفيديو — اختياري">
        <Text style={[styles.body,{color:colors.textSecondary}]}>{media.filter(item=>item.type==='image').length}/5 صور · {media.some(item=>item.type==='video')?'فيديو مضاف':'لا فيديو'}. الصورة الأولى هي صورة العرض الأساسية. حتى 50 MiB لكل ملف، والفيديو حتى دقيقتين.</Text>
        <View style={styles.row}>
          <View style={styles.action}><AppButton design="refined" title="إضافة صور" variant="outline" disabled={locked || !ready || media.filter(item=>item.type==='image').length>=5} onPress={()=>{void pick('image');}}/></View>
          <View style={styles.action}><AppButton design="refined" title="إضافة فيديو" variant="outline" disabled={locked || !ready || media.some(item=>item.type==='video')} onPress={()=>{void pick('video');}}/></View>
        </View>
        {picking ? <Text style={[styles.body,{color:colors.infoForeground}]}>جارٍ التحقق من الملفات المختارة…</Text> : null}
        <View style={styles.row}>{media.map(item=><View key={item.key} style={[styles.media,{backgroundColor:colors.surfaceSecondary,borderColor:colors.borderSubtle}]}>
          {item.type==='image'?<Image source={{uri:item.uri}} style={styles.image}/>:<Text style={[styles.body,{color:colors.text}]}>{item.name}</Text>}
          <Text style={[styles.body,{color:colors.textSecondary}]}>{item.type==='video'?'فيديو':media.filter(entry=>entry.type==='image')[0]?.key===item.key?'الصورة الأساسية':'صورة إضافية'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`حذف ${item.name}`} disabled={locked} onPress={()=>onRemoveMedia(item.key)} style={[styles.remove,{backgroundColor:locked?colors.disabledSurface:colors.errorSurface}]}><Text style={[styles.strong,{color:locked?colors.disabledForeground:colors.errorForeground}]}>حذف</Text></Pressable>
        </View>)}</View>
      </Section>
      <Section title="التوفر والحفظ">
        <View style={styles.row}><View style={styles.action}><Text style={[styles.strong,{color:colors.text}]}>متاح للطلب</Text><Text style={[styles.body,{color:colors.textSecondary}]}>يُضبط بعد تأكيد المنتج ووسائطه. الظهور للزبائن يخضع لحالة المتجر الحالية.</Text></View><Switch disabled={locked || !ready} value={form.available} onValueChange={value=>change('available',value)} trackColor={{false:colors.borderStrong,true:colors.primaryLight}} thumbColor={form.available?colors.primary:colors.surface}/></View>
        {progress ? <Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.infoForeground}]}>{progress}</Text>:null}
        <AppButton design="refined" title={saveLabel} loading={busy} disabled={saveDisabled} onPress={onSave}/>
        <AppButton design="refined" title="إلغاء والعودة" variant="outline" disabled={busy || picking} onPress={onCancel}/>
      </Section>

 </>;
}
function Section({title,children,onLayoutY}:{title:string;children:ReactNode;onLayoutY?:(value:number)=>void}) {
  const {colors}=useTheme();
  return <View onLayout={event=>onLayoutY?.(event.nativeEvent.layout.y)} style={[productEditorStyles.section,{backgroundColor:colors.surface,borderColor:colors.borderSubtle}]}><Text style={[Typography.cardTitle,productEditorStyles.right,{color:colors.text}]}>{title}</Text>{children}</View>;
}
export const productEditorStyles=StyleSheet.create({
  screen:{flex:1},content:{padding:LayoutSpacing.pageGutter,paddingBottom:Spacing.six,gap:Spacing.three,width:'100%',maxWidth:MaxContentWidth,alignSelf:'center'},
  section:{padding:Spacing.four,gap:Spacing.three,borderWidth:1,borderRadius:Radius.lg},stack:{gap:Spacing.two},
  row:{flexDirection:'row-reverse',flexWrap:'wrap',alignItems:'center',gap:Spacing.two},action:{flexGrow:1,flexShrink:1,flexBasis:130},
  body:{...Typography.body,textAlign:'right'},strong:{...Typography.bodyStrong,textAlign:'right'},right:{textAlign:'right'},
  status:{gap:Spacing.two,alignItems:'center'},message:{...Typography.body,textAlign:'right',padding:Spacing.three,borderWidth:1,borderRadius:Radius.md,gap:Spacing.two},
  media:{flexBasis:140,flexGrow:1,padding:Spacing.two,borderRadius:Radius.md,borderWidth:1,gap:Spacing.two},image:{width:'100%',height:140,resizeMode:'cover',borderRadius:Radius.sm},remove:{minHeight:44,minWidth:44,padding:Spacing.two,borderRadius:Radius.sm,alignItems:'center',justifyContent:'center'},
});
