import {attachBrandingPlayback,brandingLinkRemaining} from '@/lib/store-branding-view';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {File} from 'expo-file-system';
import {Image} from 'expo-image';
import {useVideoPlayer,VideoView} from 'expo-video';
import {AppButton} from '@/components/ui/AppButton';
import {AppModal} from '@/components/ui/AppModal';
import {FinancialCard,FinancialText} from '@/components/merchant/MerchantFinancialCards';
import {useTheme} from '@/context/ThemeContext';
import {Fonts} from '@/constants/theme';
import {newProductKey} from '@/lib/merchant-product-create';
import {createBrandingFlow,type BrandingSelection} from '@/lib/store-branding-flow';
import {checkBrandingSignature,validateBrandingInput,type BrandingAsset,type BrandingKind} from '@/lib/store-branding-contract';
import {readCurrentBranding,resumeBrandingAttempt,registerBranding,uploadBranding,publishBranding,unpublishBranding,finishBrandingAttempt,cancelBrandingAttempt,brandingDisplayUrl} from '@/lib/store-branding';

async function readSelection(s:BrandingSelection){const file=new File(s.uri);if(!file.exists||file.size!==s.size)throw Error('الملف غير متاح أو تغير. اختره مجددًا.');validateBrandingInput(s.kind,s.mime,file.size);const bytes=await file.arrayBuffer();if(bytes.byteLength!==s.size)throw Error('تغير الملف.');checkBrandingSignature(s.mime,bytes);return bytes;}
export function MerchantStoreBranding({owner,store}:{owner:string;store:string}){
 const {colors}=useTheme();
 const flow=useMemo(()=>createBrandingFlow(owner,store,{read:()=>readCurrentBranding(store),resume:()=>resumeBrandingAttempt(store),register:registerBranding,upload:uploadBranding,publish:publishBranding,remove:id=>unpublishBranding(owner,id),finish:finishBrandingAttempt,cancel:cancelBrandingAttempt,bytes:readSelection,id:newProductKey}),[owner,store]);
 const [state,setState]=useState(flow.state),[focused,setFocused]=useState(false),[picking,setPicking]=useState(false),[pickError,setPickError]=useState(''),[remove,setRemove]=useState<string|null>(null),[cancel,setCancel]=useState(false);
 const pickGate=useRef(0),pickLock=useRef(false);
 useEffect(()=>flow.subscribe(setState),[flow]);
 useFocusEffect(useCallback(()=>{setFocused(true);void flow.activate();return()=>{pickGate.current++;setFocused(false);setRemove(null);setCancel(false);setPickError('');setPicking(false);flow.deactivate();};},[flow]));
 const choose=async(kind:BrandingKind)=>{if(pickLock.current||state.busy||!state.ready||state.pending)return;pickLock.current=true;const gate=pickGate.current;setPicking(true);setPickError('');try{
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(gate!==pickGate.current)return;if(!permission.granted)throw Error('اسمح بالوصول إلى مكتبة الوسائط من إعدادات الجهاز.');
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:kind==='logo'?['images']:['videos'],allowsMultipleSelection:false,allowsEditing:false});if(gate!==pickGate.current||result.canceled)return;
  const item=result.assets[0],file=new File(item.uri);const mime=item.mimeType||file.type;
  validateBrandingInput(kind,mime,file.size);const selection={uri:item.uri,kind,mime,size:file.size};await readSelection(selection);if(gate===pickGate.current)flow.select(selection);
 }catch{if(gate===pickGate.current)setPickError(kind==='logo'?'تعذر اختيار الصورة. استخدم JPEG أو PNG أو WebP حتى 4 MiB وتحقق من إذن الوصول.':'تعذر اختيار الفيديو. اختر MP4 حتى 50 MiB وتحقق من إذن الوصول.');}finally{pickLock.current=false;if(gate===pickGate.current)setPicking(false);}};
 const disabled=state.busy||picking||!state.ready||!!state.pending;
 return <View style={{gap:12}}>
  {state.busy?<View accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary}/><FinancialText>{state.pending?'جارٍ تنفيذ محاولة الوسائط…':'جارٍ تحميل وسائط المتجر…'}</FinancialText></View>:null}
  {state.error||pickError?<Text accessibilityRole="alert" style={{fontFamily:Fonts.regular,textAlign:'right',color:colors.errorForeground}}>{pickError||state.error}</Text>:null}
  {state.notice?<Text accessibilityLiveRegion="polite" style={{fontFamily:Fonts.regular,textAlign:'right',color:colors.successForeground}}>{state.notice}</Text>:null}
  <AppButton design="refined" title="تحديث حالة الوسائط" variant="outline" disabled={state.busy||picking} onPress={()=>void flow.activate()}/>
  {state.pending?<FinancialCard title="محاولة تحتاج متابعة">
   <FinancialText>قد يكون الملف قد رُفع رغم فقد الاستجابة. لن يُرفع مرة ثانية. تحقّق من نشر المحاولة نفسها، أو ألغها ثم اختر ملفًا من جديد. إلغاء محاولة منشورة يزيل مرجعها.</FinancialText>
   <AppButton design="refined" title="التحقق والنشر دون إعادة الرفع" disabled={state.busy||picking} onPress={()=>void flow.reconcile()}/>
   <AppButton design="refined" title="إلغاء المحاولة" variant="outline" disabled={state.busy||picking} onPress={()=>setCancel(true)}/>
  </FinancialCard>:null}
  {(['logo','promo_video'] as const).map(kind=>{const current=state.current.find(a=>a.kind===kind);return <FinancialCard key={kind} title={kind==='logo'?'شعار المتجر':'الفيديو الترويجي'}>
   <FinancialText>{kind==='logo'?'JPEG / PNG / WebP · حتى 4 MiB':'MP4 · حتى 50 MiB، وقد يكون الحد العام للمشروع أقل. لا يوجد تحقق خادمي من الترميز أو المدة.'}</FinancialText>
   {current?<><FinancialText>يوجد {kind==='logo'?'شعار':'فيديو'} منشور.</FinancialText>{focused?<BrandingPreview key={current.id} asset={current} kind={kind}/>:null}</>:state.ready?<FinancialText>لم تضف {kind==='logo'?'شعارًا':'فيديو ترويجيًا'} بعد.</FinancialText>:null}
   <AppButton design="refined" title={current?'اختيار بديل':'اختيار من الجهاز'} variant="outline" disabled={disabled} onPress={()=>void choose(kind)}/>
   {current?<AppButton design="refined" title={kind==='logo'?'إزالة الشعار':'إزالة الفيديو'} variant="danger" disabled={disabled} onPress={()=>setRemove(current.id)}/>:null}
  </FinancialCard>;})}
  {state.selected?<FinancialCard title="معاينة الملف المختار — لم يُرفع بعد">
   <FinancialText>{(state.selected.size/1048576).toFixed(2)} MiB</FinancialText>
   {focused?<BrandingPreview key={state.selected.uri} uri={state.selected.uri} kind={state.selected.kind}/>:null}
   <AppButton design="refined" title="رفع وحفظ الوسيط" loading={state.busy} disabled={disabled} onPress={()=>void flow.save()}/>
   <AppButton design="refined" title="تجاهل الاختيار" variant="outline" disabled={state.busy||!!state.pending} onPress={()=>flow.select(null)}/>
  </FinancialCard>:null}
  <AppModal design="refined" visible={!!remove||cancel} title={cancel?'إلغاء محاولة الوسائط':'إزالة وسيط المتجر'} message="سيُزال مرجع هذا الوسيط دون حذف الملف من Storage. هل تريد المتابعة؟" destructive confirmText="تأكيد الإزالة" cancelText="تراجع" busy={state.busy} onCancel={()=>{setRemove(null);setCancel(false);}} onConfirm={()=>{const id=remove;setRemove(null);setCancel(false);if(id)void flow.remove(id);else void flow.cancel();}}/>
 </View>;
}
function BrandingPreview({asset,uri,kind}:{asset?:BrandingAsset;uri?:string;kind:BrandingKind}){
 const [source,setSource]=useState<string|null>(uri??null),[open,setOpen]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;let timer:ReturnType<typeof setTimeout>|undefined;if(!asset||kind==='promo_video'&&!open)return()=>{live=false;};
  void brandingDisplayUrl(asset).then(link=>{if(!live)return;setError('');setSource(link.url);timer=setTimeout(()=>{if(!live)return;setSource(null);setOpen(false);if(kind==='logo')setRevision(v=>v+1);else setError('انتهى رابط العرض. افتح المشغل مجددًا.');},brandingLinkRemaining(link.expiresAt));}).catch(()=>{if(live)setError('تعذر تحميل الوسيط. حدّث رابط العرض.');});return()=>{live=false;clearTimeout(timer);};
 },[asset,uri,kind,open,revision]);
 return <View style={{gap:8}}>{error?<FinancialText>{error}</FinancialText>:null}
  {kind==='logo'&&source?<Image source={{uri:source}} cachePolicy="none" contentFit="contain" accessibilityLabel="شعار المتجر" style={{width:'100%',height:160}} onError={()=>{setSource(null);setError('تعذر عرض الصورة. حدّث الرابط.');}}/>:null}
  {kind==='promo_video'?<><AppButton design="refined" title={open?'إغلاق المشغل':'عرض مشغل الفيديو'} variant="outline" onPress={()=>{if(asset)setSource(null);setError('');setOpen(v=>!v);setRevision(v=>v+1);}}/>{open&&source?<BrandingVideo key={source} uri={source}/>:null}</>:<AppButton design="refined" title="تحديث رابط الصورة" variant="outline" onPress={()=>setRevision(v=>v+1)}/>}
 </View>;
}
function BrandingVideo({uri}:{uri:string}){
 const [error,setError]=useState('');const player=useVideoPlayer(uri); // Native play control only: no autoplay.
 useEffect(()=>attachBrandingPlayback(player,()=>setError('تعذر تشغيل الفيديو. تحقق من الشبكة أو صيغة الملف، ثم افتح المشغل مجددًا.')),[player]);
 return <View>{error?<FinancialText>{error}</FinancialText>:null}<VideoView player={player} nativeControls contentFit="contain" allowsPictureInPicture={false} style={{width:'100%',height:210}} accessibilityLabel="الفيديو الترويجي للمتجر"/></View>;
}
