import { useOrderRealtime } from "@/hooks/useOrderRealtime";
import { MerchantProductForm, productEditorStyles as styles } from "@/components/merchant/MerchantProductForm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, BackHandler, type ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import { useTheme } from "@/context/ThemeContext";
import { useMerchantWorkspace } from "@/context/MerchantWorkspaceContext";
import { useCustomerCatalog } from "@/context/CustomerCatalogContext";
import { invalidateLocalCache } from "@/lib/local-cache";
import { invalidateMerchantHome } from "@/lib/merchant-home";
import { appendProductMedia, emptyProductForm, newProductKey, productAttempt, productExitDecision, validateProduct, type ProductAttempt, type ProductForm, type ProductMediaDraft } from "@/lib/merchant-product-create";
import { abandonProductAttempt, clearProductAttempt, createProductCreationSession, inspectLocalProductMedia, readProductAttempt, readProductCategories, readProductIdentity } from "@/lib/merchant-product-create-api";

export function MerchantAddProduct({ ownerId }: { ownerId: string }) {
  const { colors } = useTheme();
  const { setNotice } = useMerchantWorkspace();
  const { refreshProductAvailability } = useCustomerCatalog();
  const router = useRouter(), navigation = useNavigation();
  const [form,setForm] = useState<ProductForm>({...emptyProductForm});
  const [media,setMedia] = useState<ProductMediaDraft[]>([]);
  const [categories,setCategories] = useState<{id:string;name:string}[]>([]);
  const [store,setStore] = useState<{id:string;name:string}|null>(null);
  const [ready,setReady] = useState(false), [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false), [picking,setPicking] = useState(false);
  const [attempt,setAttempt] = useState<ProductAttempt|null>(null);
  const [error,setError] = useState(""), [progress,setProgress] = useState("");
  const [errors,setErrors] = useState<Partial<Record<keyof ProductForm,string>>>({});
  const [exitOpen,setExitOpen] = useState(false), [busyExit,setBusyExit] = useState(false);
  const alive = useRef(true), busyRef = useRef(false), pickingRef = useRef(false), allowExit = useRef(false);
  const focused = useRef(true);
  const sequence = useRef(0), restoredStore = useRef<string|null>(null);
  const referenceRequest = useRef<AbortController|null>(null);
  const pendingExit = useRef<(() => void)|null>(null);
  const refs = useRef<Partial<Record<keyof ProductForm,TextInput|null>>>({});
  const scroll = useRef<ScrollView>(null), categoryY = useRef(0), firstSectionY = useRef(0);
  const pricingY = useRef(0), unitY = useRef(0);
  const session = useMemo(() => createProductCreationSession(),[]);
  const saver = session.saver;
  const dirty = JSON.stringify(form) !== JSON.stringify(emptyProductForm) || media.length > 0 || Boolean(attempt);
  const locked = busy || picking || Boolean(attempt);
  const leave = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace({pathname:"/merchant/catalog",params:{tab:"products"}}); },[router]);
  const requestExit = useCallback((action: () => void) => {
    if (allowExit.current) { action(); return; }
    const decision = productExitDecision(dirty,busyRef.current || pickingRef.current);
    if (decision === "busy") { setBusyExit(true); return; }
    if (decision === "confirm") { if (!pendingExit.current) { pendingExit.current = action; setExitOpen(true); } return; }
    action();
  },[dirty]);
  usePreventRemove(dirty || busy || picking,({data}) => requestExit(() => navigation.dispatch(data.action)));
  useFocusEffect(useCallback(() => {
    focused.current = true;
    session.activate();
    const handler = BackHandler.addEventListener("hardwareBackPress",() => { requestExit(leave); return true; });
    return () => { focused.current = false;session.deactivate();handler.remove(); };
  },[leave,requestExit,session]));
  const load = useCallback(async (quiet = false) => {
    const request = ++sequence.current;
    referenceRequest.current?.abort();
    referenceRequest.current = new AbortController();
    const signal = referenceRequest.current.signal;
    const current = () => alive.current && !signal.aborted && request === sequence.current;
    if (!quiet) { setLoading(true);setError(""); }
    try {
      if (quiet) {
        const options = await readProductCategories(signal);
        if (current()) setCategories(options);
        return;
      }
      const [identity,options] = await Promise.all([readProductIdentity(ownerId,signal),readProductCategories(signal)]);
      if (!current()) return;
      if (restoredStore.current && restoredStore.current !== identity.id) throw new Error("Scope changed");
      if (!restoredStore.current) {
        const pending = await readProductAttempt(ownerId,identity.id);
        if (!current()) return;
        if (pending) { setAttempt(pending);setForm({...pending.form});setMedia(pending.media.map(item=>({...item}))); }
        restoredStore.current = identity.id;
      }
      setStore(identity);setCategories(options);setReady(true);
    } catch { if (current()) { if (!quiet) setReady(false);setError("تعذر تحميل المتجر أو التصنيفات أو التحقق من محاولة سابقة. أعد المحاولة؛ لن نبدأ إنشاءً جديدًا قبل التحقق."); } }
    finally { if (current()) setLoading(false); }
  },[ownerId]);
  useEffect(() => {
    alive.current = true;
    const timer = setTimeout(()=>{void load();},0);
    return () => { clearTimeout(timer);alive.current = false;referenceRequest.current?.abort(); };
  },[load]);
  useOrderRealtime({ channelName: `product-editor-categories:${ownerId}`, enabled: ready,
    subscriptions: [{ table: "catalog_category_revision" }], onChange: () => {
      if (!busyRef.current && !pickingRef.current) return load(true);
    } });
  const change = <K extends keyof ProductForm>(field: K,value: ProductForm[K]) => {
    if (busyRef.current || pickingRef.current || attempt) return;
    setForm(previous=>({...previous,[field]:value}));setErrors(previous=>({...previous,[field]:undefined}));
  };
  const discardAndLeave = async () => {
    if (busyRef.current || pickingRef.current) return;
    const action = pendingExit.current;
    busyRef.current=true;setBusy(true);
    try {
      if (attempt) await abandonProductAttempt(attempt,()=>alive.current&&focused.current);
    } catch { /* Keep the durable recovery record whenever existence is uncertain. */ }
    finally { busyRef.current=false;if(alive.current)setBusy(false); }
    if (!alive.current || !focused.current) return;
    pendingExit.current=null;setExitOpen(false);allowExit.current=true;action?.();
  };
  const pick = async (type: "image"|"video") => {
    if (busyRef.current || pickingRef.current || attempt || !ready) return;
    pickingRef.current = true;setPicking(true);setError("");
    try {
      const remaining = type === "image" ? 5-media.filter(item=>item.type==='image').length : media.some(item=>item.type==='video') ? 0 : 1;
      if (remaining <= 0) throw new Error(type === "image" ? "الحد خمس صور." : "الحد فيديو واحد.");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("اسمح بالوصول إلى مكتبة الصور لاختيار الوسائط.");
      const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:type==='image'?['images']:['videos'],allowsMultipleSelection:type==='image',selectionLimit:remaining,...(type==='image'?{quality:0.85}:{})});
      if (result.canceled || !alive.current) return;
      const additions: ProductMediaDraft[] = [];
      for (const asset of result.assets) {
        if (type==='video' && (!asset.duration || asset.duration > 120_000)) throw new Error("اختر فيديو مدته لا تتجاوز دقيقتين ويمكن التحقق من مدته.");
        const actual = await inspectLocalProductMedia(asset.uri,type);
        additions.push({key:newProductKey(),uri:asset.uri,name:asset.fileName ?? (type==='image'?'صورة المنتج':'فيديو المنتج'),type,mime:actual.mime,size:actual.size,...(asset.duration?{duration:asset.duration}:{})});
      }
      if (alive.current) setMedia(appendProductMedia(media,additions));
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "تعذر قراءة الوسائط. أعد اختيارها."); }
    finally { pickingRef.current=false;if(alive.current)setPicking(false); }
  };
  const save = async () => {
    if (!alive.current || busyRef.current || pickingRef.current || !ready || !store) return;
    if (!attempt) {
      const validation = validateProduct(form,categories);setErrors(validation.errors);
      const field = Object.keys(validation.errors)[0] as keyof ProductForm|undefined;
      if (field) {
        if (refs.current[field]) refs.current[field]?.focus();
        else scroll.current?.scrollTo({ y: field === 'unit' ? pricingY.current + unitY.current : firstSectionY.current + categoryY.current, animated: true });
        return;
      }
    }
    busyRef.current=true;setBusy(true);setError("");
    let confirmed = false;
    let started = Boolean(attempt);
    try {
      if (!attempt) {
        const options = await readProductCategories();
        if (!alive.current || !focused.current) return;
        setCategories(options);
        if (!options.some(option=>option.id===form.categoryId)) {
          setErrors(previous=>({...previous,categoryId:"لم يعد التصنيف المختار نشطًا. اختر تصنيفًا آخر."}));
          scroll.current?.scrollTo({y:firstSectionY.current+categoryY.current,animated:true});
          return;
        }
      }
      const snapshot = attempt ?? productAttempt(ownerId,store.id,form,media,categories);
      started = true;
      setAttempt(snapshot); // Freeze the snapshot for every subsequent retry.
      const saved = await saver.save(snapshot,message=>{if(alive.current)setProgress(message);});
      if (!saved) return;
      confirmed = true;
      if (!alive.current || !focused.current) return;
      invalidateMerchantHome(ownerId);
      await invalidateLocalCache(`merchant-products:${ownerId}`);
      // Catalogue refresh is secondary to the confirmed product write.
      void refreshProductAvailability(snapshot.id).catch(()=>undefined);
      await clearProductAttempt(snapshot);
      if (!alive.current || !focused.current) return;
      setNotice("تمت إضافة المنتج إلى متجرك.");allowExit.current=true;leave();
    } catch {
      if (alive.current) setError(confirmed ? "تم تأكيد حفظ المنتج، لكن تعذر إنهاء سجل المحاولة محليًا. اختر «التحقق والاستكمال» لإتمامها دون إنشاء منتج آخر." : started ? "تعذر تأكيد نتيجة الحفظ. احتفظنا بالمحاولة نفسها؛ تحقق من الاتصال ثم اختر «التحقق والاستكمال». قد يكون المنتج محفوظًا جزئيًا في الكتالوج. لن نحذف ملفات أو ننشئ معرفًا بديلًا تلقائيًا." : "تعذر التحقق من التصنيف قبل الحفظ. لم نبدأ إنشاء المنتج؛ مدخلاتك ما زالت في الصفحة. تحقق من الاتصال وحاول مجددًا.");
    } finally {
      invalidateMerchantHome(ownerId); // Even a partial inactive insert changes the authoritative count.
      busyRef.current=false;
      if(alive.current){setBusy(false);setProgress("");}
    }
  };
  return <View style={[styles.screen,{backgroundColor:colors.background}]}>
    <KeyboardAwareScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <View style={styles.status}><ActivityIndicator color={colors.primary}/><Text style={[styles.body,{color:colors.textSecondary}]}>جارٍ التحقق من المتجر والتصنيفات…</Text></View> : null}
      {error && !ready ? <View style={[styles.message,{backgroundColor:colors.errorSurface,borderColor:colors.errorBorder}]}><Text accessibilityLiveRegion="polite" style={[styles.body,{color:colors.errorForeground}]}>{error}</Text>
        {!ready ? <AppButton design="refined" title="إعادة المحاولة" variant="outline" onPress={()=>{void load();}} disabled={loading}/> : null}
      </View> : null}
      {attempt ? <Text style={[styles.message,{color:colors.infoForeground,backgroundColor:colors.infoSurface,borderColor:colors.infoBorder}]}>هذه محاولة محفوظة للتحقق والاستكمال. ثُبتت الحقول والوسائط لتجنب تكرار المنتج. عند المغادرة قد يبقى منتج غير متاح؛ راجعه من الكتالوج.</Text> : null}
      <MerchantProductForm form={form} media={media} categories={categories} errors={errors} locked={locked} ready={ready} loading={loading} picking={picking} busy={busy} progress={progress}
        change={change} onFieldRef={(key,input)=>{refs.current[key]=input;}} onFirstSectionLayoutY={value=>{firstSectionY.current=value;}} onCategoryLayoutY={value=>{categoryY.current=value;}}
        onPricingLayoutY={value=>{pricingY.current=value;}} onUnitLayoutY={value=>{unitY.current=value;}}
        pick={type=>{void pick(type);}} onRemoveMedia={key=>{if(!busyRef.current&&!pickingRef.current&&!attempt)setMedia(previous=>previous.filter(item=>item.key!==key));}}
        onSave={()=>{void save();}} onCancel={()=>requestExit(leave)} saveLabel={attempt?'التحقق والاستكمال':'إضافة المنتج'} saveError={ready ? error : undefined} saveDisabled={!ready || loading || picking || !categories.length}/>
    </KeyboardAwareScrollView>
    <AppModal design="refined" visible={exitOpen} title="مغادرة إضافة المنتج؟" message={attempt?"لن نحذف المنتج أو الملفات. إذا تأكدنا من وجود المنتج سننهي متابعة المحاولة محليًا، ويمكنك إكماله من الكتالوج. إذا تعذر التأكد سنحتفظ بالمحاولة للتحقق عند العودة.":"ستفقد المدخلات غير المحفوظة."} confirmText="تجاهل التغييرات والمغادرة" cancelText="البقاء" destructive busy={busy} onCancel={()=>{pendingExit.current=null;setExitOpen(false);}} onConfirm={()=>{void discardAndLeave();}}/>
    <AppModal design="refined" visible={busyExit} title="العملية قيد التنفيذ" message="انتظر اكتمال التحقق أو الرفع قبل مغادرة الصفحة. لا تغلق التطبيق أثناء الحفظ." onCancel={()=>setBusyExit(false)}/>
  </View>;
}
