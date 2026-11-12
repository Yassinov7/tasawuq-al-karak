import {attachBrandingPlayback,brandingLinkRemaining} from '@/lib/store-branding-view';
import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ActivityIndicator,StyleSheet,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {File} from 'expo-file-system';
import {Image} from 'expo-image';
import {useVideoPlayer,VideoView} from 'expo-video';
import {AppButton} from '@/components/ui/AppButton';
import {AppModal} from '@/components/ui/AppModal';
import {AppIcon} from '@/components/ui/AppIcon';
import {useTheme} from '@/context/ThemeContext';
import {Radius,Spacing,Typography} from '@/constants/theme';
import {newProductKey} from '@/lib/merchant-product-create';
import {createBrandingFlow,type BrandingSelection} from '@/lib/store-branding-flow';
import {checkBrandingSignature,validateBrandingInput,type BrandingAsset,type BrandingKind} from '@/lib/store-branding-contract';
import {readCurrentBranding,resumeBrandingAttempt,registerBranding,uploadBranding,publishBranding,unpublishBranding,finishBrandingAttempt,cancelBrandingAttempt,brandingDisplayUrl} from '@/lib/store-branding';

async function readSelection(s:BrandingSelection){const file=new File(s.uri);if(!file.exists||file.size!==s.size)throw Error('الملف غير متاح أو تغير. اختره مجددًا.');validateBrandingInput(s.kind,s.mime,file.size);const bytes=await file.arrayBuffer();if(bytes.byteLength!==s.size)throw Error('تغير الملف.');checkBrandingSignature(s.mime,bytes);return bytes;}
type Props = { owner: string; store: string; renderDetails: (logo: ReactNode, dirty: boolean, busy: boolean) => ReactNode };
type Preview = { kind: BrandingKind; asset?: BrandingAsset; uri?: string };

export function MerchantStoreBranding({owner,store,renderDetails}:Props){
 const {colors}=useTheme();
 const flow=useMemo(()=>createBrandingFlow(owner,store,{read:()=>readCurrentBranding(store),resume:()=>resumeBrandingAttempt(store),register:registerBranding,upload:uploadBranding,publish:publishBranding,remove:id=>unpublishBranding(owner,id),finish:finishBrandingAttempt,cancel:cancelBrandingAttempt,bytes:readSelection,id:newProductKey}),[owner,store]);
 const [state,setState]=useState(flow.state),[focused,setFocused]=useState(false),[picking,setPicking]=useState(false),[pickError,setPickError]=useState(''),[remove,setRemove]=useState<string|null>(null),[cancel,setCancel]=useState(false);
 const [preview,setPreview]=useState<Preview|null>(null);
 const pickGate=useRef(0),pickLock=useRef(false);
 useEffect(()=>flow.subscribe(setState),[flow]);
 useFocusEffect(useCallback(()=>{setFocused(true);void flow.activate();return()=>{pickGate.current++;setFocused(false);setRemove(null);setCancel(false);setPreview(null);setPickError('');setPicking(false);flow.deactivate();};},[flow]));
 const choose=async(kind:BrandingKind)=>{if(pickLock.current||state.busy||!state.ready||state.pending)return;pickLock.current=true;const gate=pickGate.current;setPicking(true);setPickError('');try{
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(gate!==pickGate.current)return;if(!permission.granted)throw Error('اسمح بالوصول إلى مكتبة الوسائط من إعدادات الجهاز.');
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:kind==='logo'?['images']:['videos'],allowsMultipleSelection:false,allowsEditing:false});if(gate!==pickGate.current||result.canceled)return;
  const item=result.assets[0],file=new File(item.uri);const mime=item.mimeType||file.type;
  validateBrandingInput(kind,mime,file.size);const selection={uri:item.uri,kind,mime,size:file.size};await readSelection(selection);if(gate===pickGate.current)flow.select(selection);
 }catch{if(gate===pickGate.current)setPickError(kind==='logo'?'تعذر اختيار الصورة. استخدم JPEG أو PNG أو WebP حتى 4 ميغابايت وتحقق من إذن الوصول.':'تعذر اختيار الفيديو. اختر MP4 حتى 50 ميغابايت وتحقق من إذن الوصول.');}finally{pickLock.current=false;if(gate===pickGate.current)setPicking(false);}};
 const disabled=state.busy||picking||!state.ready||!!state.pending;
 const logo=state.current.find(asset=>asset.kind==='logo');
 const publishedLogo=useBrandingSource(focused?logo:undefined);
 const pendingRemoval=state.current.find(asset=>asset.id===remove);
 const pendingTitle=state.pending?.kind==='logo'?'الشعار':'الفيديو';
 return <>
  {renderDetails(<LogoTile uri={publishedLogo.uri} onError={publishedLogo.failed} large />,Boolean(state.selected || remove || cancel),picking || (state.busy && state.ready))}
  <View style={[styles.identity,{borderColor:colors.borderSubtle}]}>
   <View style={styles.row}>
    <Text accessibilityRole="header" style={[Typography.cardTitle,styles.flex,{color:colors.text,textAlign:'right'}]}>هوية المتجر</Text>
    <AppButton compact fullWidth={false} icon="refresh-outline" title="تحديث الوسائط" variant="outline" disabled={state.busy||picking} onPress={()=>void flow.activate()}/>
   </View>
   {state.busy?<View style={styles.row}><ActivityIndicator color={colors.primary} accessibilityLabel="جارٍ تحديث الوسائط"/></View>:null}
   {state.error||pickError||publishedLogo.error?<Text accessibilityRole="alert" style={[styles.body,{color:colors.errorForeground}]}>{pickError||state.error||publishedLogo.error}</Text>:null}
   {state.notice?<Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.successForeground}]}>{state.notice}</Text>:null}
   {(['logo','promo_video'] as const).map(kind=>{
    const isLogo=kind==='logo';
    const current=state.current.find(asset=>asset.kind===kind);
    const draft=state.selected?.kind===kind?state.selected:null;
    const pending=state.pending?.kind===kind;
    const title=isLogo?'شعار المتجر':'الفيديو الترويجي';
    return <View key={kind} style={[styles.media,{borderColor:colors.borderSubtle}]}>
     <View style={styles.row}>
      <View style={[styles.mediumIcon,{backgroundColor:colors.surfaceSecondary}]}>
       <AppIcon name={isLogo?'image-outline':'videocam-outline'} size={22} color={colors.primary}/>
      </View>
      <View style={styles.flex}>
       <Text accessibilityRole="header" style={[Typography.bodyStrong,styles.right,{color:colors.text}]}>{title}</Text>
       <Text style={[styles.body,{color:colors.textSecondary}]}>{current?'منشور في المتجر':state.ready?(isLogo?'لا يوجد شعار منشور':'لا يوجد فيديو منشور'):'حالة النشر غير متاحة بعد'}</Text>
      </View>
     </View>
     <View style={styles.row}>
      <AppButton compact fullWidth={false} icon={current?'swap-horizontal-outline':'add-outline'} title={current?'استبدال':'اختيار'} accessibilityLabel={`${current?'استبدال':'اختيار'} ${title}`} variant="outline" disabled={disabled} onPress={()=>void choose(kind)}/>
      {current?<AppButton compact fullWidth={false} icon={isLogo?'eye-outline':'play-outline'} title="معاينة" accessibilityLabel={`معاينة ${title} المنشور`} variant="outline" onPress={()=>setPreview({kind,asset:current})}/>:null}
      {current?<AppButton compact fullWidth={false} icon="trash-outline" title="إزالة" accessibilityLabel={`إزالة ${title}`} variant="danger" disabled={disabled} onPress={()=>setRemove(current.id)}/>:null}
     </View>
     {draft?<View style={[styles.draft,{backgroundColor:colors.warningSurface}]}>
      <View style={styles.row}>{isLogo?<LogoTile uri={draft.uri}/>:null}<Text style={[Typography.bodyStrong,styles.right,styles.flex,{color:colors.warningForeground}]}>{pending?'الملف المختار · نتيجة النشر قيد التحقق':'ملف جديد · لم يُحفظ بعد'}</Text></View>
      <Text style={[styles.body,{color:colors.textSecondary}]}>{(draft.size/1048576).toFixed(2)} ميغابايت</Text>
      <View style={styles.row}>
       <AppButton compact fullWidth={false} icon={isLogo?'eye-outline':'play-outline'} title="معاينة الملف" variant="outline" onPress={()=>setPreview({kind,uri:draft.uri})}/>
       {!pending?<><AppButton compact fullWidth={false} icon="checkmark-outline" title={isLogo?'حفظ الشعار':'حفظ الفيديو'} loading={state.busy} disabled={disabled} onPress={()=>void flow.save()}/>
       <AppButton compact fullWidth={false} icon="close-outline" title="إلغاء الاختيار" variant="outline" disabled={state.busy||picking} onPress={()=>flow.select(null)}/></>:null}
      </View>
     </View>:null}
    </View>;
   })}
   {state.pending?<View style={[styles.draft,{backgroundColor:colors.warningSurface}]}>
    <Text style={[Typography.bodyStrong,styles.right,{color:colors.warningForeground}]}>نشر {pendingTitle} يحتاج إلى تحقق</Text>
    <Text style={[styles.body,{color:colors.text}]}>تحقق من المحاولة نفسها. يمكن إلغاؤها قبل اختيار ملف آخر.</Text>
    <View style={styles.row}>
     <AppButton compact fullWidth={false} title="التحقق والنشر" disabled={state.busy||picking} onPress={()=>void flow.reconcile()}/>
     <AppButton compact fullWidth={false} title="إلغاء المحاولة" variant="outline" disabled={state.busy||picking} onPress={()=>setCancel(true)}/>
    </View>
   </View>:null}
  </View>
  {focused&&preview&&(!preview.asset||state.current.some(asset=>asset.id===preview.asset?.id))?<PreviewDialog key={preview.uri??preview.asset?.id} preview={preview} logoSource={publishedLogo} close={()=>setPreview(null)}/>:null}
  <AppModal design="refined" visible={!!remove||cancel} title={cancel?'إلغاء محاولة الوسائط':pendingRemoval?.kind==='logo'?'إزالة الشعار؟':'إزالة الفيديو؟'}
   message={cancel?'إذا كان الوسيط قد نُشر، فسيختفي من صفحة المتجر عند إلغاء المحاولة.':'يبقى الوسيط منشورًا حتى تؤكد الإزالة.'} destructive
   confirmText={cancel?'إلغاء المحاولة':'تأكيد الإزالة'} cancelText="تراجع" busy={state.busy}
   onCancel={()=>{setRemove(null);setCancel(false);}} onConfirm={()=>{const id=remove;setRemove(null);setCancel(false);if(id)void flow.remove(id);else void flow.cancel();}}/>
 </>;
}

function useBrandingSource(asset?:BrandingAsset){
 const [link,setLink]=useState<{id:string;url:string}|null>(null),[failure,setFailure]=useState<string|null>(null),[revision,setRevision]=useState(0);
 const id=asset?.id;
 useEffect(()=>{
  if(!asset)return;
  let active=true;
  let timer:ReturnType<typeof setTimeout>|undefined;
  void brandingDisplayUrl(asset).then(value=>{
   if(!active)return;
   setLink({id:asset.id,url:value.url});setFailure(null);
   timer=setTimeout(()=>{setLink(null);if(asset.kind==='logo')setRevision(v=>v+1);else setFailure(asset.id);},brandingLinkRemaining(value.expiresAt));
  }).catch(()=>{if(active)setFailure(asset.id);});
  return()=>{active=false;clearTimeout(timer);setLink(previous=>previous?.id===asset.id?null:previous);};
 },[asset,revision]);
 return {
  uri:id&&link?.id===id&&failure!==id?link.url:undefined,
  error:id&&failure===id?'تعذر عرض الوسيط. أعد تحميل المعاينة.':null,
  retry:()=>setRevision(value=>value+1),
  failed:()=>{if(id)setFailure(id);},
 };
}

function LogoTile({uri,onError,large=false}:{uri?:string;onError?:()=>void;large?:boolean}){
 const {colors}=useTheme();
 return <View style={[styles.logo,large&&styles.largeLogo,{backgroundColor:colors.surface,borderColor:colors.borderSubtle}]}>
  {uri?<Image source={{uri}} cachePolicy="none" contentFit="contain" accessibilityLabel="شعار المتجر" style={styles.image} onError={onError}/>
   :<AppIcon name="storefront-outline" size={large?30:22} color={colors.textSecondary}/>}
 </View>;
}

function PreviewDialog({preview,logoSource,close}:{preview:Preview;logoSource:ReturnType<typeof useBrandingSource>;close:()=>void}){
 const {colors}=useTheme();
 const [localImageError,setLocalImageError]=useState(false);
 const video=preview.kind==='promo_video';
 const remoteVideo=useBrandingSource(video?preview.asset:undefined);
 const source=video?remoteVideo:logoSource;
 const uri=preview.uri??source.uri;
 return <AppModal design="refined" visible title={video?'معاينة الفيديو':'معاينة الشعار'}
  message={preview.uri?'معاينة الملف المختار قبل الحفظ.':undefined} confirmText="إغلاق" onCancel={close} onConfirm={close}>
  {localImageError?<Text style={[styles.body,{color:colors.errorForeground}]}>تعذر عرض الصورة المختارة.</Text>:uri?(video?<BrandingVideo key={uri} uri={uri}/>:<Image source={{uri}} cachePolicy="none" contentFit="contain" accessibilityLabel="معاينة الشعار" style={styles.previewImage} onError={preview.uri?()=>setLocalImageError(true):source.failed}/>)
   :source.error?<View style={styles.stack}><Text style={[styles.body,{color:colors.errorForeground}]}>{source.error}</Text><AppButton compact fullWidth={false} title="إعادة تحميل المعاينة" variant="outline" onPress={source.retry}/></View>
   :<ActivityIndicator color={colors.primary} accessibilityLabel="جارٍ تحميل المعاينة"/>}
 </AppModal>;
}

function BrandingVideo({uri}:{uri:string}){
 const {colors}=useTheme();
 const [error,setError]=useState('');
 const player=useVideoPlayer(uri);
 useEffect(()=>attachBrandingPlayback(player,()=>setError('تعذر تشغيل الفيديو. تحقق من الشبكة أو صيغة الملف، ثم افتح المعاينة مجددًا.')),[player]);
 return <View>{error?<Text style={[styles.body,{color:colors.errorForeground}]}>{error}</Text>:null}
  <VideoView player={player} nativeControls contentFit="contain" allowsPictureInPicture={false} style={styles.previewImage} accessibilityLabel="الفيديو الترويجي للمتجر"/></View>;
}

const styles=StyleSheet.create({
 identity:{gap:Spacing.two,borderTopWidth:StyleSheet.hairlineWidth,paddingTop:Spacing.three},
 media:{gap:Spacing.two,borderBottomWidth:StyleSheet.hairlineWidth,paddingVertical:Spacing.two},
 stack:{gap:Spacing.two},draft:{gap:Spacing.one,padding:Spacing.two,borderRadius:Radius.md},
 row:{flexDirection:'row-reverse',flexWrap:'wrap',alignItems:'center',gap:Spacing.two},
 flex:{flex:1,minWidth:0},right:{textAlign:'right'},body:{...Typography.body,textAlign:'right'},
 mediumIcon:{width:44,height:44,borderRadius:Radius.md,alignItems:'center',justifyContent:'center'},
 logo:{width:48,height:48,borderWidth:1,borderRadius:Radius.md,alignItems:'center',justifyContent:'center',overflow:'hidden'},
 largeLogo:{width:76,height:76},image:{width:'100%',height:'100%'},previewImage:{width:'100%',height:200},
});
