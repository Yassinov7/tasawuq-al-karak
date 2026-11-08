import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useFocusEffect,useNavigation,useRouter} from "expo-router";
import {usePreventRemove} from "expo-router/react-navigation";
import * as ImagePicker from "expo-image-picker";
import {ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,ScrollView,Text,TextInput,View} from "react-native";
import {AppButton} from "@/components/ui/AppButton";
import {AppModal} from "@/components/ui/AppModal";
import {MerchantProductForm,productEditorStyles as styles} from "@/components/merchant/MerchantProductForm";
import {useTheme} from "@/context/ThemeContext";
import {useMerchantWorkspace} from "@/context/MerchantWorkspaceContext";
import {useCustomerCatalog} from "@/context/CustomerCatalogContext";
import {invalidateLocalCache} from "@/lib/local-cache";
import {invalidateMerchantHome} from "@/lib/merchant-home";
import {newProductKey,productExitDecision,type ProductForm,type ProductMediaDraft} from "@/lib/merchant-product-create";
import {inspectLocalProductMedia,readProductCategories} from "@/lib/merchant-product-create-api";
import {appendEditMedia,createProductEditLoadGate,productEditAttempt,validateProductEdit,type EditDraftMedia,type ProductEditAttempt} from "@/lib/merchant-product-edit";
import {abandonProductEditAttempt,clearProductEditAttempt,createProductEditSession,loadEditableProduct,readProductEditAttempt} from "@/lib/merchant-product-edit-api";

type Loaded=Awaited<ReturnType<typeof loadEditableProduct>>;
export function MerchantEditProduct({ownerId,productId}:{ownerId:string;productId:string}){
 const {colors}=useTheme(),{headerHeight,setNotice}=useMerchantWorkspace(),{refreshProductAvailability}=useCustomerCatalog();
 const router=useRouter(),navigation=useNavigation();
 const [form,setForm]=useState<ProductForm|null>(null),[media,setMedia]=useState<EditDraftMedia[]>([]);
 const [categories,setCategories]=useState<{id:string;name:string}[]>([]),[ready,setReady]=useState(false),[loading,setLoading]=useState(true);
 const [categoryError,setCategoryError]=useState(false),[loadError,setLoadError]=useState(false);
 const [error,setError]=useState(''),[progress,setProgress]=useState(''),[busy,setBusy]=useState(false),[picking,setPicking]=useState(false);
 const [attempt,setAttempt]=useState<ProductEditAttempt|null>(null),[errors,setErrors]=useState<Partial<Record<keyof ProductForm,string>>>({});
 const [exitOpen,setExitOpen]=useState(false),[busyExit,setBusyExit]=useState(false);
 const alive=useRef(true),focused=useRef(true),busyRef=useRef(false),pickingRef=useRef(false),allowExit=useRef(false);
 const initial=useRef<Loaded|null>(null),request=useRef<AbortController|null>(null),pendingExit=useRef<(()=>void)|null>(null);
 const refs=useRef<Partial<Record<keyof ProductForm,TextInput|null>>>({}),scroll=useRef<ScrollView>(null),sectionY=useRef(0),categoryY=useRef(0);
 const gate=useMemo(()=>createProductEditLoadGate(),[]),session=useMemo(()=>createProductEditSession(),[]);
 const [baselineView,setBaselineView]=useState<{form:ProductForm;keys:string[]}|null>(null);
 const dirty=Boolean(attempt)||(form!==null&&baselineView!==null&&(JSON.stringify(form)!==JSON.stringify(baselineView.form)||JSON.stringify(media.map(item=>item.key))!==JSON.stringify(baselineView.keys)));
 const locked=busy||picking||Boolean(attempt);
 const leave=useCallback(()=>{if(router.canGoBack())router.back();else router.replace({pathname:'/merchant/catalog',params:{tab:'products'}});},[router]);
 const requestExit=useCallback((action:()=>void)=>{
  if(allowExit.current){action();return;}
  const decision=productExitDecision(dirty,busyRef.current||pickingRef.current);
  if(decision==='busy'){setBusyExit(true);return;}
  if(decision==='confirm'){if(!pendingExit.current){pendingExit.current=action;setExitOpen(true);}return;}action();
 },[dirty]);
 usePreventRemove(dirty||busy||picking,({data})=>requestExit(()=>navigation.dispatch(data.action)));
 useFocusEffect(useCallback(()=>{
  focused.current=true;session.activate();
  const handler=BackHandler.addEventListener('hardwareBackPress',()=>{requestExit(leave);return true;});
  return()=>{focused.current=false;session.deactivate();handler.remove();};
 },[leave,requestExit,session]));
 const load=useCallback(async()=>{
  const latest=gate.begin();request.current?.abort();request.current=new AbortController();const signal=request.current.signal;
  const current=()=>alive.current&&!signal.aborted&&latest();
  setLoading(true);setError('');
  try{
   if(!initial.current){
    const data=await loadEditableProduct(ownerId,productId,signal);if(!current())return;
    const pending=await readProductEditAttempt(ownerId,data.store.id,productId);if(!current())return;
    initial.current=data;setBaselineView({form:{...data.form},keys:data.media.map(item=>item.key)});
    setForm(pending?{...pending.form}:data.form);setMedia(pending?pending.media.map(item=>({...item})):data.media);setAttempt(pending);
   }
   setLoadError(false);setReady(true);
   try{const options=await readProductCategories(signal);if(!current())return;setCategories(options);setCategoryError(false);}
   catch{if(current()){setCategoryError(true);setError('تعذر تحميل التصنيفات. مدخلاتك محفوظة في الصفحة؛ أعد المحاولة.');}}
  }catch{if(current()){setReady(false);setLoadError(true);setError('تعذر تحميل المنتج أو التحقق من ملكيته أو استكمال تعديل سابق. أعد المحاولة؛ لن نعرض أو نعدل منتجًا غير متاح لهذا المتجر.');}}
  finally{if(current())setLoading(false);}
 },[gate,ownerId,productId]);
 useEffect(()=>{alive.current=true;const timer=setTimeout(()=>{void load();},0);return()=>{clearTimeout(timer);alive.current=false;request.current?.abort();gate.cancel();};},[gate,load]);
 const change=<K extends keyof ProductForm>(key:K,value:ProductForm[K])=>{
  if(busyRef.current||pickingRef.current||attempt)return;
  setForm(previous=>previous?{...previous,[key]:value}:previous);setErrors(previous=>({...previous,[key]:undefined}));
 };
 const pick=async(type:'image'|'video')=>{
  if(busyRef.current||pickingRef.current||attempt||!ready)return;
  pickingRef.current=true;setPicking(true);setError('');
  try{
   const remaining=type==='image'?5-media.filter(item=>item.type==='image').length:media.some(item=>item.type==='video')?0:1;
   if(remaining<=0)throw new Error('الحد الإجمالي خمس صور وفيديو واحد.');
   const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)throw new Error('اسمح بالوصول إلى مكتبة الصور لاختيار الوسائط.');
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:type==='image'?['images']:['videos'],allowsMultipleSelection:type==='image',selectionLimit:remaining,...(type==='image'?{quality:0.85}:{})});
   if(result.canceled||!alive.current)return;
   const added:ProductMediaDraft[]=[];
   for(const asset of result.assets){
    if(type==='video'&&(!asset.duration||asset.duration>120000))throw new Error('اختر فيديو لا يتجاوز دقيقتين ويمكن التحقق من مدته.');
    const actual=await inspectLocalProductMedia(asset.uri,type);
    added.push({key:newProductKey(),uri:asset.uri,name:asset.fileName??(type==='image'?'صورة المنتج':'فيديو المنتج'),type,mime:actual.mime,size:actual.size,...(asset.duration?{duration:asset.duration}:{})});
   }
   if(alive.current&&focused.current)setMedia(appendEditMedia(media,added));
  }catch(failure){if(alive.current)setError(failure instanceof Error?failure.message:'تعذر قراءة الوسائط.');}
  finally{pickingRef.current=false;if(alive.current)setPicking(false);}
 };
 const save=async()=>{
  if(!form||!initial.current||!ready||busyRef.current||pickingRef.current||categoryError)return;
  if(!attempt){
   const validation=validateProductEdit(form,categories,initial.current.product);setErrors(validation.errors);
   const field=Object.keys(validation.errors)[0] as keyof ProductForm|undefined;
   if(field){if(refs.current[field])refs.current[field]?.focus();else scroll.current?.scrollTo({y:sectionY.current+categoryY.current,animated:true});return;}
  }
  busyRef.current=true;setBusy(true);setError('');let confirmed=false,started=Boolean(attempt);
  try{
   if(!attempt){
    const options=await readProductCategories();if(!alive.current||!focused.current)return;setCategories(options);
    if(!options.some(option=>option.id===form.categoryId)){setErrors(previous=>({...previous,categoryId:'لم يعد التصنيف نشطًا. اختر تصنيفًا آخر.'}));scroll.current?.scrollTo({y:sectionY.current+categoryY.current,animated:true});return;}
   }
   const snapshot=attempt??productEditAttempt(ownerId,initial.current.product,initial.current.originals,form,media,categories);
   started=true;setAttempt(snapshot);
   const saved=await session.saver.save(snapshot,message=>{if(alive.current)setProgress(message);});if(!saved)return;confirmed=true;
   if(!alive.current||!focused.current)return;
   invalidateMerchantHome(ownerId);await invalidateLocalCache(`merchant-products:${ownerId}`);void refreshProductAvailability(productId).catch(()=>undefined);
   await clearProductEditAttempt(snapshot);if(!alive.current||!focused.current)return;
   setNotice('تم حفظ تعديلات المنتج.');allowExit.current=true;leave();
  }catch{
   if(alive.current)setError(confirmed?'تم تأكيد التعديلات، لكن تعذر إنهاء متابعتها محليًا. اختر «التحقق والاستكمال» دون تكرار العمليات.':started?'تعذر تأكيد نتيجة التعديل. قد تكون بعض التغييرات محفوظة. احتفظنا بالقيم والمعرفات نفسها؛ تحقق من الاتصال واختر «التحقق والاستكمال». لن نحذف ملفات Storage أو نعيد كتابة تغيير متعارض.':'تعذر التحقق من التصنيف قبل الحفظ؛ مدخلاتك ما زالت في الصفحة.');
  }finally{
   if(started){invalidateMerchantHome(ownerId);void invalidateLocalCache(`merchant-products:${ownerId}`).catch(()=>undefined);void refreshProductAvailability(productId).catch(()=>undefined);}
   busyRef.current=false;if(alive.current){setBusy(false);setProgress('');}
  }
 };
 const discard=async()=>{
  if(busyRef.current||pickingRef.current)return;const action=pendingExit.current;busyRef.current=true;setBusy(true);
  try{if(attempt)await abandonProductEditAttempt(attempt,()=>alive.current&&focused.current);}catch{/* Retain the recovery record if ownership/result cannot be confirmed. */}
  finally{busyRef.current=false;if(alive.current)setBusy(false);}
  if(!alive.current||!focused.current)return;pendingExit.current=null;setExitOpen(false);allowExit.current=true;action?.();
 };
 return <KeyboardAvoidingView style={[styles.screen,{backgroundColor:colors.background}]} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={headerHeight}>
  <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   {loading?<View style={styles.status}><ActivityIndicator color={colors.primary}/><Text style={[styles.body,{color:colors.textSecondary}]}>جارٍ تحميل المنتج والتصنيفات…</Text></View>:null}
   {error?<View style={[styles.message,{backgroundColor:colors.errorSurface,borderColor:colors.errorBorder}]}><Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{error}</Text>{loadError||categoryError?<AppButton design="refined" title="إعادة المحاولة" variant="outline" disabled={loading||busy||picking} onPress={()=>{void load();}}/>:null}</View>:null}
   {attempt?<Text style={[styles.message,{color:colors.infoForeground,backgroundColor:colors.infoSurface,borderColor:colors.infoBorder}]}>هذه محاولة تعديل محفوظة للاستكمال. ثُبتت الحقول والوسائط حتى التحقق من النتيجة. إزالة الوسائط تعني إزالة روابطها عند الحفظ، مع إبقاء الملفات نفسها آمنة.</Text>:null}
   {form&&ready?<MerchantProductForm form={form} media={media} categories={categories} errors={errors} locked={locked} ready={ready} loading={loading} picking={picking} busy={busy} progress={progress}
    change={change} onFieldRef={(key,input)=>{refs.current[key]=input;}} onFirstSectionLayoutY={value=>{sectionY.current=value;}} onCategoryLayoutY={value=>{categoryY.current=value;}}
    pick={type=>{void pick(type);}} onRemoveMedia={key=>{if(!busyRef.current&&!pickingRef.current&&!attempt)setMedia(previous=>previous.filter(item=>item.key!==key));}}
    onSave={()=>{void save();}} onCancel={()=>requestExit(leave)} saveLabel={attempt?'التحقق والاستكمال':'حفظ التعديلات'} saveDisabled={loading||picking||categoryError||!categories.length}/>:<AppButton design="refined" title="العودة" variant="outline" onPress={()=>requestExit(leave)}/>}
  </ScrollView>
  <AppModal design="refined" visible={exitOpen} title="مغادرة تعديل المنتج؟" message={attempt?'قد تكون بعض التغييرات محفوظة. المغادرة لا تعكس التعديلات المؤكدة ولا تحذف ملفات؛ سننهي المتابعة المحلية فقط إذا تأكدنا من وجود المنتج، وإلا نحتفظ بها للاستكمال.':'ستفقد التغييرات غير المحفوظة.'} confirmText="تجاهل التغييرات والمغادرة" cancelText="البقاء" destructive busy={busy} onCancel={()=>{pendingExit.current=null;setExitOpen(false);}} onConfirm={()=>{void discard();}}/>
  <AppModal design="refined" visible={busyExit} title="العملية قيد التنفيذ" message="انتظر انتهاء الحفظ أو التحقق قبل المغادرة." onCancel={()=>setBusyExit(false)}/>
 </KeyboardAvoidingView>;
}
