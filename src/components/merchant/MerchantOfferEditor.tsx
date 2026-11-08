import{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{useFocusEffect,useNavigation,useRouter}from'expo-router';
import{usePreventRemove}from'expo-router/react-navigation';
import{ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,ScrollView,Text,View}from'react-native';
import{AppButton}from'@/components/ui/AppButton';
import{AppModal}from'@/components/ui/AppModal';
import{MerchantOfferForm,emptyOfferPicker,type OfferPickerState}from'@/components/merchant/MerchantOfferForm';
import{productEditorStyles as styles}from'@/components/merchant/MerchantProductForm';
import{useTheme}from'@/context/ThemeContext';
import{useMerchantWorkspace}from'@/context/MerchantWorkspaceContext';
import{useCustomerCatalog}from'@/context/CustomerCatalogContext';
import{invalidateMerchantHome}from'@/lib/merchant-home';
import{invalidateLocalCache}from'@/lib/local-cache';
import{invalidatePublicCatalog}from'@/lib/public-catalog';
import{readProductIdentity}from'@/lib/merchant-product-create-api';
import{productExitDecision}from'@/lib/merchant-product-create';
import{createOfferReadGate,emptyOfferForm,formFromOffer,validateOffer,type OfferAttempt,type OfferErrors,type OfferForm,type OfferLoaded,type OfferProduct,type OfferSaveResult,type OfferType}from'@/lib/merchant-offer-editor';
import{createOfferEditorSession,readMerchantOffer,readOfferAttempt,readOfferProducts,readSelectedOfferProducts}from'@/lib/merchant-offer-editor-api';
const copyForm=(form:OfferForm):OfferForm=>({...form,items:form.items.map(item=>({...item}))});
const mergeProducts=(previous:OfferProduct[],next:OfferProduct[])=>[...new Map([...previous,...next].map(row=>[row.id,row])).values()];
export function MerchantOfferEditor({ownerId,offerId}:{ownerId:string;offerId:string|null}){
 const{colors}=useTheme(),{headerHeight,setNotice}=useMerchantWorkspace(),{refresh}=useCustomerCatalog();const router=useRouter(),navigation=useNavigation();
 const[store,setStore]=useState<{id:string;name:string}|null>(null),[form,setForm]=useState<OfferForm|null>(null),[baselineForm,setBaselineForm]=useState<OfferForm|null>(null),[products,setProducts]=useState<OfferProduct[]>([]);
 const[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState<OfferErrors>({});
 const[pending,setPending]=useState<OfferAttempt|null>(null),[conflict,setConflict]=useState(false),[exitOpen,setExitOpen]=useState(false),[busyExit,setBusyExit]=useState(false),[reviewOpen,setReviewOpen]=useState(false),[nextType,setNextType]=useState<OfferType|null>(null);
 const[picker,setPicker]=useState<OfferPickerState>(emptyOfferPicker),[pickerRetry,setPickerRetry]=useState(0);
 const alive=useRef(true),focused=useRef(true),busyRef=useRef(false),allowExit=useRef(false),baseline=useRef<OfferLoaded|null>(null),initialRequest=useRef<AbortController|null>(null),pickerRequest=useRef<AbortController|null>(null),pickerBusy=useRef(false),pickerCursor=useRef<string|null>(null),pendingExit=useRef<(()=>void)|null>(null),scroll=useRef<ScrollView>(null);
 const gate=useMemo(()=>createOfferReadGate(),[]),pickerGate=useMemo(()=>createOfferReadGate(),[]),session=useMemo(()=>createOfferEditorSession(),[]);
 const[startsAt,setStartsAt]=useState<string|undefined>(undefined);
 const[now,setNow]=useState(()=>Date.now()),[savedId,setSavedId]=useState<string|null>(null);const finishedId=useRef<string|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const dirty=Boolean(pending)||(form!==null&&baselineForm!==null&&JSON.stringify(form)!==JSON.stringify(baselineForm));
 const locked=busy||Boolean(pending)||Boolean(savedId)||loading;
 const catalog=useCallback(()=>router.replace({pathname:'/merchant/catalog',params:{tab:'offers'}}),[router]);
 const leave=useCallback(()=>{if(router.canGoBack())router.back();else catalog();},[router,catalog]);
 const requestExit=useCallback((action:()=>void)=>{
  if(allowExit.current){action();return;}const decision=productExitDecision(dirty,busyRef.current);
  if(decision==='busy'){setBusyExit(true);return;}if(decision==='confirm'){if(!pendingExit.current){pendingExit.current=action;setExitOpen(true);}return;}action();
 },[dirty]);
 usePreventRemove(dirty||busy,({data})=>requestExit(()=>navigation.dispatch(data.action)));
 useFocusEffect(useCallback(()=>{focused.current=true;session.activate();const handler=BackHandler.addEventListener('hardwareBackPress',()=>{requestExit(leave);return true;});return()=>{focused.current=false;session.deactivate();handler.remove();};},[leave,requestExit,session]));
 const load=useCallback(async()=>{
  const latest=gate.begin();initialRequest.current?.abort();initialRequest.current=new AbortController();const signal=initialRequest.current.signal,current=()=>alive.current&&!signal.aborted&&latest();setLoading(true);setError('');
  try{
   const identity=await readProductIdentity(ownerId,signal);if(!current())return;
   const data=offerId?await readMerchantOffer(identity.id,offerId,signal):null;if(!current())return;
   const recovery=await readOfferAttempt(ownerId,identity.id,offerId);if(!current())return;
   const value=recovery?copyForm(recovery.form):data?formFromOffer(data):copyForm(emptyOfferForm);
   const recoveryProducts=recovery?await readSelectedOfferProducts(identity.id,recovery.form.items.map(item=>item.productId),signal):[];if(!current())return;
   baseline.current=recovery?.baseline??data;setStartsAt((recovery?.baseline??data)?.offer.starts_at);setStore(identity);setForm(value);setBaselineForm(data?formFromOffer(data):copyForm(emptyOfferForm));setProducts(mergeProducts(data?.products??[],recoveryProducts));setPending(recovery);if(recovery)session.saver.restore(recovery);setErrors({});setConflict(false);setLoadError(false);
  }catch{if(current()){setLoadError(true);setError('تعذر تحميل المتجر أو العرض أو التحقق من محاولة سابقة. أعد المحاولة؛ لا نعرض عرضًا غير تابع لهذا المتجر.');}}
  finally{if(current())setLoading(false);}
 },[gate,offerId,ownerId,session]);
 useEffect(()=>{alive.current=true;const timer=setTimeout(()=>{void load();},0);return()=>{clearTimeout(timer);alive.current=false;initialRequest.current?.abort();pickerRequest.current?.abort();gate.cancel();pickerGate.cancel();};},[gate,load,pickerGate]);
 const loadPicker=useCallback(async(more:boolean,storeId:string,query:string)=>{
  if(busyRef.current)return;
  if(more&&pickerBusy.current)return;
  if(!more){pickerRequest.current?.abort();pickerCursor.current=null;}
  const latest=more?null:pickerGate.begin();
  // A continuation shares the current query generation but remains cancellable.
  const controller=new AbortController();pickerRequest.current=controller;const signal=controller.signal;
  const current=()=>alive.current&&!signal.aborted&&(!latest||latest());pickerBusy.current=true;
  setPicker(previous=>({...previous,...(more?{moreLoading:true}:{loading:true,rows:[],error:''})}));
  try{const rows=await readOfferProducts(storeId,query,more?pickerCursor.current:null,signal);if(!current())return;pickerCursor.current=rows.at(-1)?.id??pickerCursor.current;setPicker(previous=>({...previous,rows:more?mergeProducts(previous.rows,rows):rows,hasMore:rows.length>0,error:''}));}
  catch{if(current())setPicker(previous=>({...previous,error:'تعذر تحميل المنتجات. أعد المحاولة؛ اختياراتك لم تتغير.'}));}
  finally{if(current()){pickerBusy.current=false;setPicker(previous=>({...previous,loading:false,moreLoading:false}));}}
 },[pickerGate]);
 // Search and pagination share a request function without coupling page results to search effects.
 useEffect(()=>{if(!picker.open||!store?.id)return;const storeId=store.id;const timer=setTimeout(()=>{void loadPicker(false,storeId,picker.query);},250);return()=>{clearTimeout(timer);pickerRequest.current?.abort();pickerGate.cancel();pickerBusy.current=false;};
 },[loadPicker,picker.open,picker.query,pickerRetry,store?.id,pickerGate]);
 const closePicker=()=>{pickerRequest.current?.abort();pickerGate.cancel();pickerBusy.current=false;setPicker(previous=>({...previous,open:false}));};
 const change=<K extends keyof OfferForm>(key:K,value:OfferForm[K])=>{if(busyRef.current||pending||loading)return;setForm(previous=>previous?{...previous,[key]:value}:previous);setErrors({});setError('');};
 const choose=(product:OfferProduct)=>{
  if(!form||locked||busyRef.current||!product.is_available)return;const role=picker.role;setProducts(previous=>mergeProducts(previous,[product]));
  setForm(previous=>{if(!previous)return previous;const exists=previous.items.some(item=>item.productId===product.id&&item.role===role);const item={key:`${role}:${product.id}`,productId:product.id,role,quantity:String(product.minimum_quantity)};
   const items=role==='buy'||role==='reward'?[...previous.items.filter(item=>item.role!==role),item]:exists?previous.items.filter(item=>!(item.productId===product.id&&item.role===role)):[...previous.items,item];return{...previous,items};});setErrors({});if(role==='buy'||role==='reward')closePicker();
 };
 const invalidate=useCallback(async()=>{invalidateMerchantHome(ownerId);await invalidateLocalCache(`merchant-offers:${ownerId}`);await invalidatePublicCatalog();void refresh().catch(()=>undefined);},[ownerId,refresh]);
 const complete=async(result:OfferSaveResult)=>{
  if(!alive.current)return;
  setPending(session.saver.getPending());
  if(result.kind==='confirmed'){finishedId.current=result.id;setSavedId(result.id);await invalidate();if(!alive.current||!focused.current)return;setNotice(offerId?'تم حفظ تعديلات العرض.':'تم إنشاء العرض.');allowExit.current=true;catalog();}
  else{setError(result.message);setConflict(result.kind==='conflict');if(result.kind==='unknown')await invalidate();scroll.current?.scrollTo({y:0,animated:true});}
 };
 const save=async()=>{
  if(busyRef.current||!form||!store||loading)return;
  if(finishedId.current){busyRef.current=true;setBusy(true);try{await complete({kind:'confirmed',id:finishedId.current});}catch{if(alive.current)setError('تم حفظ العرض؛ تعذر تحديث القائمة. حاول العودة إلى العروض مجددًا.');}finally{busyRef.current=false;if(alive.current)setBusy(false);}return;}
  const local=pending?null:validateOffer(form,products,offerId,startsAt);if(local&&!local.args){setErrors(local.errors);scroll.current?.scrollTo({y:0,animated:true});return;}
  busyRef.current=true;setBusy(true);setError('');
  try{
   if(pending){await complete(await session.saver.verify());return;}
   const fresh=await readSelectedOfferProducts(store.id,form.items.map(item=>item.productId));if(!alive.current||!focused.current)return;
   const selected=new Set(form.items.map(item=>item.productId)),found=new Set(fresh.map(item=>item.id));setProducts(previous=>mergeProducts(previous.map(item=>selected.has(item.id)&&!found.has(item.id)?{...item,is_available:false}:item),fresh));
   const checked=validateOffer(form,fresh,offerId,startsAt);if(!checked.args){setErrors(checked.errors);scroll.current?.scrollTo({y:0,animated:true});return;}
   const attempt:OfferAttempt={version:1,ownerId,storeId:store.id,offerId,form:copyForm(form),args:checked.args,baseline:baseline.current,status:'sending',resultId:null};
   await complete(await session.saver.save(attempt));
  }catch{if(alive.current){setPending(session.saver.getPending());setError('تعذر إتمام التحقق أو تحديث العرض. إن أُرسلت محاولة فستبقى محفوظة للتحقق دون إعادة إرسال تلقائية.');}}
  finally{busyRef.current=false;if(alive.current)setBusy(false);}
 };
 const reviewReset=async()=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);
  try{if(!await session.saver.discardAfterReview())return;setPending(null);setPicker(emptyOfferPicker);setReviewOpen(false);await load();}
  catch{if(alive.current)setError('تعذر إنهاء متابعة المحاولة محليًا. لن نبدأ إنشاءً آخر قبل التحقق.');}
  finally{busyRef.current=false;if(alive.current)setBusy(false);}
 };
 const preview=form?validateOffer(form,products,offerId,startsAt,now).preview:null;
 return<KeyboardAvoidingView style={[styles.screen,{backgroundColor:colors.background}]} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={headerHeight}>
  <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   {loading?<View style={styles.status}><ActivityIndicator color={colors.primary}/><Text style={[styles.body,{color:colors.textSecondary}]}>جارٍ تحميل العرض والتحقق من المتجر…</Text></View>:null}
   {error?<View style={[styles.message,{backgroundColor:colors.errorSurface,borderColor:colors.errorBorder}]}><Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{error}</Text>{loadError?<AppButton design="refined" title="إعادة المحاولة" variant="outline" disabled={loading||busy} onPress={()=>{void load();}}/>:null}</View>:null}
   {pending?<View style={[styles.message,{backgroundColor:colors.warningSurface,borderColor:colors.warningBorder}]}><Text style={[styles.body,{color:colors.warningForeground}]}>هناك محاولة حفظ تحتاج إلى تحقق. الحقول ثابتة، ولن نعيد إرسال RPC تلقائيًا. {pending.offerId||pending.resultId?'زر الحفظ يتحقق بالقراءة فقط.':'معرف الإنشاء غير مؤكد؛ راجع قائمة العروض أولًا.'}</Text><AppButton design="refined" title="فتح قائمة العروض للتحقق" variant="outline" disabled={busy} onPress={()=>requestExit(catalog)}/><AppButton design="refined" title={offerId?'راجعت النتيجة؛ تحميل النسخة الحالية':'راجعت القائمة؛ بدء نموذج جديد'} variant="outline" disabled={busy} onPress={()=>setReviewOpen(true)}/></View>:null}
   {conflict?<AppButton design="refined" title="إعادة تحميل النسخة الحالية" variant="outline" disabled={busy} onPress={()=>setReviewOpen(true)}/>:null}
   {form&&!loadError?<MerchantOfferForm form={form} products={products} errors={errors} preview={preview} startsAt={startsAt} now={now} confirmed={Boolean(savedId)} locked={locked} busy={busy} pending={Boolean(pending)}
    change={change} changeType={type=>{if(locked||busyRef.current||form.type===type)return;if(form.items.length)setNextType(type);else change('type',type);}}
    openPicker={role=>{if(!locked&&!busyRef.current)setPicker({...emptyOfferPicker,open:true,role,loading:true});}}
    remove={key=>{if(!locked&&!busyRef.current){setForm(previous=>previous?{...previous,items:previous.items.filter(item=>item.key!==key)}:previous);setErrors({});}}}
    quantity={(key,value)=>{if(!locked&&!busyRef.current){setForm(previous=>previous?{...previous,items:previous.items.map(item=>item.key===key?{...item,quantity:value}:item)}:previous);setErrors({});}}}
    save={()=>{void save();}} cancel={()=>requestExit(leave)} picker={picker}
    pickerQuery={value=>{pickerRequest.current?.abort();pickerGate.cancel();pickerBusy.current=false;setPicker(previous=>({...previous,query:value,rows:[],loading:true,hasMore:false,error:''}));}}
    pickerMore={()=>{if(store&&picker.open&&picker.hasMore&&!picker.error&&!picker.loading)void loadPicker(true,store.id,picker.query);}} pickerRetry={()=>setPickerRetry(value=>value+1)} pickerClose={closePicker} choose={choose}/>:!loading?<AppButton design="refined" title="العودة" variant="outline" onPress={()=>requestExit(leave)}/>:null}
  </ScrollView>
  <AppModal design="refined" visible={exitOpen} title="مغادرة نموذج العرض؟" message={pending?'ستبقى محاولة الحفظ للتحقق عند العودة. المغادرة لا تلغي عرضًا قد حُفظ على الخادم.':'ستفقد التغييرات غير المحفوظة.'} confirmText="تجاهل التغييرات والمغادرة" cancelText="البقاء" destructive onCancel={()=>{pendingExit.current=null;setExitOpen(false);}} onConfirm={()=>{const action=pendingExit.current;pendingExit.current=null;setExitOpen(false);allowExit.current=true;action?.();}}/>
  <AppModal design="refined" visible={busyExit} title="الحفظ قيد التنفيذ" message="انتظر نتيجة الحفظ أو التحقق قبل المغادرة." onCancel={()=>setBusyExit(false)}/>
  <AppModal design="refined" visible={nextType!==null} title="تغيير نوع العرض؟" message="ستحتاج إلى اختيار مكونات النوع الجديد صراحةً. لن نحتفظ بمكونات مخفية من النوع السابق." confirmText="تغيير النوع والمكونات" cancelText="البقاء" onCancel={()=>setNextType(null)} onConfirm={()=>{if(nextType&&!busyRef.current&&!pending){setForm(previous=>previous?{...previous,type:nextType,items:[]}:previous);setErrors({});}setNextType(null);}}/>
  <AppModal design="refined" visible={reviewOpen} title="تأكيد مراجعة النتيجة" message="لا نعرف أن محاولة غير مؤكدة قد أُلغيت. تأكد من قائمة العروض أولًا. سننهي المتابعة المحلية ونحمّل نموذجًا جديدًا أو أحدث نسخة؛ لا يُحذف أي عرض ولا تُرسل RPC هنا." confirmText="راجعت النتيجة؛ متابعة" cancelText="البقاء" busy={busy} onCancel={()=>setReviewOpen(false)} onConfirm={()=>{void reviewReset();}}/>
 </KeyboardAvoidingView>;
}
