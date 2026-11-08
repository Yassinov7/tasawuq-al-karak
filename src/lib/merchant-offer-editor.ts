import type { Tables, Database } from "@/types/database";
import { parseProductNumber } from "@/lib/merchant-product-create";
import { formatSyp } from "@/lib/money";
import { localOfferEndInstant } from "@/lib/offer-expiration";
export type OfferType=Tables<"store_offers">["offer_type"];
export type OfferRole=Tables<"store_offer_products">["item_role"];
export type OfferProduct=Pick<Tables<"products">,"id"|"title"|"price"|"selling_unit"|"minimum_quantity"|"quantity_step"|"is_available">;
export type OfferRecord=Pick<Tables<"store_offers">,"id"|"store_id"|"title"|"description"|"offer_type"|"discount_method"|"discount_value"|"bundle_price"|"starts_at"|"ends_at"|"is_active"|"updated_at">;
export type OfferItem=Pick<Tables<"store_offer_products">,"id"|"product_id"|"item_role"|"quantity">;
export type OfferLoaded={offer:OfferRecord;items:OfferItem[];products:OfferProduct[]};
export type OfferSelection={key:string;productId:string;role:OfferRole;quantity:string};
export type OfferForm={title:string;description:string;type:OfferType;discountMethod:"percentage"|"fixed_amount";discountValue:string;bundlePrice:string;active:boolean;endMode:"keep"|"none"|"new";originalEndsAt:string|null;endDate:string;endTime:string;selectedEndInstant?:string;items:OfferSelection[]};
export const emptyOfferForm:OfferForm={title:'',description:'',type:'discount',discountMethod:'percentage',discountValue:'',bundlePrice:'',active:true,endMode:'none',originalEndsAt:null,endDate:'',endTime:'',items:[]};
export function formFromOffer(data:OfferLoaded):OfferForm{return{...emptyOfferForm,title:data.offer.title,description:data.offer.description,type:data.offer.offer_type,discountMethod:data.offer.discount_method??'percentage',discountValue:data.offer.discount_value===null?'':String(data.offer.discount_value),bundlePrice:data.offer.bundle_price===null?'':String(data.offer.bundle_price),active:data.offer.is_active,endMode:data.offer.ends_at?'keep':'none',originalEndsAt:data.offer.ends_at,items:data.items.map(item=>({key:item.id,productId:item.product_id,role:item.item_role,quantity:String(item.quantity)}))};}
export function normaliseOfferDigits(value:string){return value.trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/٫/g,'.');}
export function offerUnits(value:string,precision:number,scale:number):bigint{
 parseProductNumber(value,precision,scale);
 const [integer,fraction='']=normaliseOfferDigits(value).split('.');
 return BigInt(integer)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0')||'0');
}
const moneyMax=99999999999999n;
const roundRatio=(numerator:bigint,denominator:bigint)=>(numerator+denominator/2n)/denominator;
export function checkoutOfferQuantity(quantity:string,product:OfferProduct){
 const value=offerUnits(quantity,12,3),minimum=offerUnits(String(product.minimum_quantity),12,3),step=offerUnits(String(product.quantity_step),12,3);
 return value>=minimum&&(value-minimum)%step===0n;
}
export function offerEndsAt(form:OfferForm,startsAt?:string,now=Date.now()):string|null{
 if(form.endMode==='none')return null;
 let result=form.originalEndsAt;
 if(form.endMode==='new'){
  const day=normaliseOfferDigits(form.endDate),clock=normaliseOfferDigits(form.endTime);
  result=localOfferEndInstant(day,clock);
  if(form.selectedEndInstant&&Date.parse(form.selectedEndInstant)!==Date.parse(result))throw new Error('تغير توقيت الجهاز بعد اختيار الموعد. أعد اختيار التاريخ والوقت قبل الحفظ.');
 }
 if(!result||!Number.isFinite(Date.parse(result))||Date.parse(result)<=now)throw new Error('انتهت النهاية السابقة أو لم تعد صالحة. اختر نهاية مستقبلية أو أزل النهاية صراحةً.');
 if(startsAt&&Date.parse(result)<=Date.parse(startsAt))throw new Error('يجب أن تكون النهاية بعد بداية العرض المثبتة.');
 return result;
}
export type OfferArgs=Database['public']['Functions']['save_store_offer']['Args'];
export type OfferErrors=Record<string,string>;
export type OfferPreview={original:bigint;final:bigint;saving:bigint;lines:{key:string;original:bigint;final:bigint|null}[];allocationKnown:boolean};
export function validateOffer(form:OfferForm,products:readonly OfferProduct[],offerId:string|null,startsAt?:string,now=Date.now()):{errors:OfferErrors;args:OfferArgs|null;preview:OfferPreview|null}{
 const errors:OfferErrors={};
 if([...form.title.trim()].length<2||[...form.title.trim()].length>140)errors.title='عنوان العرض مطلوب من 2 إلى 140 حرفًا.';
 if([...form.description].length>5000)errors.description='الحد الأقصى للوصف 5000 حرف.';
 let end:string|null=null;try{end=offerEndsAt(form,startsAt,now);}catch(error){errors.end=(error as Error).message;}
 if(!['discount','bundle','buy_x_get_y'].includes(form.type))errors.type='اختر نوع عرض مدعومًا.';
 const permitted:OfferRole[]=form.type==='discount'?['discounted']:form.type==='bundle'?['bundle']:['buy','reward'];
 if(!form.items.length)errors.items='اختر منتجًا واحدًا على الأقل.';
 if(form.type==='buy_x_get_y'&&(form.items.length!==2||form.items.filter(item=>item.role==='buy').length!==1||form.items.filter(item=>item.role==='reward').length!==1))errors.items='اختر مكون شراء واحدًا ومكافأة واحدة بالضبط.';
 const seen=new Set<string>();let discount=0n,bundle=0n;
 try{if(form.type==='discount'){discount=offerUnits(form.discountValue,14,2);if(form.discountMethod==='percentage'&&discount>10000n)throw new Error('النسبة لا تتجاوز 100٪.');if(!['percentage','fixed_amount'].includes(form.discountMethod))throw new Error('اختر طريقة الخصم.');}}catch(error){errors.discountValue=(error as Error).message;}
 try{if(form.type==='bundle')bundle=offerUnits(form.bundlePrice,14,2);}catch(error){errors.bundlePrice=(error as Error).message;}
 const lines:{key:string;original:bigint;final:bigint|null}[]=[];let rawTotal=0n;
 for(const item of form.items){
  const duplicate=`${item.productId}:${item.role}`;
  if(seen.has(duplicate)||!permitted.includes(item.role))errors.items='راجع أدوار المنتجات؛ لا يجوز تكرار المنتج في الدور نفسه.';
  seen.add(duplicate);
  const product=products.find(value=>value.id===item.productId);
  if(!product||!product.is_available){errors[item.key]='هذا المنتج غير متاح. أزله أو استبدله قبل الحفظ.';continue;}
  try{
   const quantity=offerUnits(item.quantity,12,3),price=offerUnits(String(product.price),14,2);
   if(!checkoutOfferQuantity(item.quantity,product))throw new Error(`الكمية تبدأ من ${product.minimum_quantity} ${product.selling_unit} بخطوة ${product.quantity_step}.`);
   const raw=price*quantity,original=roundRatio(raw,1000n);rawTotal+=raw;
   let final:bigint|null=original;
   if(form.type==='discount'){
    if(form.discountMethod==='fixed_amount'){
     if(!errors.discountValue&&discount>=price)errors.discountValue='الخصم الثابت لكل وحدة يجب أن يكون أقل من سعر كل منتج مختار.';
     final=discount<price?roundRatio((price-discount)*quantity,1000n):0n;
    }else final=discount<=10000n?roundRatio(original*(10000n-discount),10000n):0n;
   }else if(form.type==='buy_x_get_y'&&item.role==='reward')final=0n;
   else if(form.type==='bundle')final=null;
   if(original>moneyMax||(final!==null&&final>moneyMax))throw new Error('إجمالي هذا المكون يتجاوز دقة مبالغ الطلب.');
   lines.push({key:item.key,original,final});
  }catch(error){errors[item.key]=(error as Error).message;}
 }
 const original=lines.reduce((sum,line)=>sum+line.original,0n);
 if(form.type==='bundle'&&!errors.bundlePrice){
  if(bundle*1000n>=rawTotal)errors.bundlePrice='سعر الحزمة يجب أن يكون أقل من مجموع أسعار مكوناتها وكمياتها.';
  if(original===0n)errors.bundlePrice='هذه الكميات تنتج مجموعًا أصليًا صفريًا بعد التقريب؛ لا يمكن تسعير الحزمة بأمان.';
  if(original>0n&&lines.length){
   const rounded=lines.map(line=>roundRatio(bundle*line.original,original)),sum=rounded.reduce((a,b)=>a+b,0n),minimum=rounded.reduce((a,b)=>a<b?a:b);
   if(sum-minimum>bundle)errors.bundlePrice='السعر صغير جدًا لتوزيعه بأمان على هذه المكونات. اختر قيمة أخرى.';
  }
 }
 const final=form.type==='bundle'?bundle:lines.reduce((sum,line)=>sum+(line.final??0n),0n);
 if(original>moneyMax||final>moneyMax)errors.items='مجموع العرض يتجاوز دقة مبالغ الطلب.';
 if(Object.keys(errors).length)return{errors,args:null,preview:null};
 return{errors,args:{selected_offer:offerId,input_title:form.title.trim(),input_description:form.description.trim(),input_type:form.type,input_discount_method:form.type==='discount'?form.discountMethod:null,input_discount_value:form.type==='discount'?Number(discount)/100:null,input_bundle_price:form.type==='bundle'?Number(bundle)/100:null,input_ends_at:end,input_is_active:form.active,input_items:form.items.map(item=>({product_id:item.productId,item_role:item.role,quantity:Number(offerUnits(item.quantity,12,3))/1000}))},preview:{original,final,saving:original-final,lines,allocationKnown:form.type!=='bundle'}};
}
export function displayOfferMoney(cents:bigint){return formatSyp(Number(cents)/100);}
function itemSignature(items:readonly {product_id:string;item_role:string;quantity:number}[]){return JSON.stringify(items.map(item=>[item.product_id,item.item_role,offerUnits(String(item.quantity),12,3).toString()]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));}
export function sameOfferVersion(a:OfferLoaded,b:OfferLoaded){return Object.entries(a.offer).every(([key,value])=>b.offer[key as keyof OfferRecord]===value)&&itemSignature(a.items)===itemSignature(b.items);}
export function offerMatchesArgs(data:OfferLoaded,args:OfferArgs){
 const offer=data.offer;
 const desired=args.input_items as {product_id:string;item_role:string;quantity:number}[];
 return offer.title===args.input_title&&offer.description===args.input_description&&offer.offer_type===args.input_type&&offer.discount_method===args.input_discount_method&&offer.discount_value===args.input_discount_value&&offer.bundle_price===args.input_bundle_price&&offer.is_active===args.input_is_active&&(offer.ends_at===null?args.input_ends_at===null:args.input_ends_at!==null&&Date.parse(offer.ends_at)===Date.parse(args.input_ends_at))&&itemSignature(data.items)===itemSignature(desired);
}
export type OfferAttempt={version:1;ownerId:string;storeId:string;offerId:string|null;form:OfferForm;args:OfferArgs;baseline:OfferLoaded|null;status:'sending'|'unknown'|'known';resultId:string|null};
export type OfferSaveResult={kind:'confirmed';id:string}|{kind:'unknown'|'conflict'|'rejected'|'blocked';message:string};
export type OfferSaveApi={persist:(attempt:OfferAttempt)=>Promise<void>;clear:(attempt:OfferAttempt)=>Promise<void>;scope:(attempt:OfferAttempt)=>Promise<void>;read:(storeId:string,id:string)=>Promise<OfferLoaded>;rpc:(args:OfferArgs)=>Promise<{data:string|null;error:{code?:string;message:string}|null}>};
export function createOfferSaver(api:OfferSaveApi){let locked=false;let pending:OfferAttempt|null=null;return{
 restore(attempt:OfferAttempt){pending=attempt;},getPending:()=>pending,isBusy:()=>locked,
 async discardAfterReview(){if(locked)return false;if(pending)await api.clear(pending);pending=null;return true;},
 async verify():Promise<OfferSaveResult>{
  if(locked)return{kind:'blocked',message:'التحقق قيد التنفيذ.'};locked=true;
  try{
   if(!pending)return{kind:'blocked',message:'لا توجد محاولة للتحقق.'};await api.scope(pending);
   const id=pending.resultId??pending.offerId;if(!id)return{kind:'unknown',message:'ضاعت استجابة الإنشاء. راجع قائمة العروض؛ لن نعيد الإنشاء تلقائيًا.'};
   const data=await api.read(pending.storeId,id);
   if(!offerMatchesArgs(data,pending.args))return{kind:'unknown',message:'لم نتمكن من تأكيد النتيجة المطلوبة. راجع قائمة العروض قبل أي محاولة أخرى.'};
   await api.clear(pending);pending=null;return{kind:'confirmed',id};
  }catch{return{kind:'unknown',message:'تعذر التحقق من النتيجة. تحقق من الاتصال ثم أعد التحقق فقط.'};}finally{locked=false;}
 },
 async save(attempt:OfferAttempt):Promise<OfferSaveResult>{
  if(locked||pending)return{kind:'blocked',message:'توجد محاولة قيد التنفيذ أو غير مؤكدة. تحقّق منها قبل الحفظ.'};locked=true;
  try{
   await api.scope(attempt);
   if(attempt.baseline&&attempt.offerId){const latest=await api.read(attempt.storeId,attempt.offerId);if(!sameOfferVersion(latest,attempt.baseline))return{kind:'conflict',message:'تغير العرض منذ فتحه. لن نستبدل النسخة الأحدث؛ أعد تحميلها بعد تجاهل تعديلاتك.'};}
   await api.persist(attempt);pending=attempt;
   let result:Awaited<ReturnType<OfferSaveApi['rpc']>>;
   try{result=await api.rpc(attempt.args);}catch{result={data:null,error:{message:'unconfirmed'}};}
   if(result.error&&/^(?:22|23|40|42|53|54|55|57|58|P0)[0-9A-Z]{3}$/.test(result.error.code??'')){
    await api.clear(attempt);pending=null;return{kind:'rejected',message:'رفض الخادم حفظ العرض. راجع أهلية المنتجات والكميات والأسعار والتاريخ ثم حاول مجددًا.'};
   }
   if(!result.error&&result.data){attempt={...attempt,status:'known',resultId:result.data};}else attempt={...attempt,status:'unknown'};
   pending=attempt;await api.persist(attempt);
   const id=attempt.resultId??attempt.offerId;
   if(id){try{const data=await api.read(attempt.storeId,id);if(offerMatchesArgs(data,attempt.args)){await api.clear(attempt);pending=null;return{kind:'confirmed',id};}}catch{/* Only verify on a later user action; never resend here. */}}
   return{kind:'unknown',message:attempt.offerId?'تعذر تأكيد نتيجة التعديل. أعد التحقق دون إعادة الحفظ.':'تعذر تأكيد نتيجة الإنشاء. راجع قائمة العروض قبل بدء محاولة أخرى؛ لن نعيد الإنشاء تلقائيًا.'};
  }catch{return{kind:pending?'unknown':'rejected',message:pending?'تعذر تأكيد النتيجة؛ احتفظنا بالمحاولة ولن نعيد إرسالها تلقائيًا.':'تعذر التحقق من المتجر أو النسخة الحالية قبل الحفظ. لم نرسل عملية حفظ.'};}finally{locked=false;}
 },
};}
export function createOfferReadGate(){let revision=0;return{begin(){const id=++revision;return()=>id===revision;},cancel(){revision++;}};}
