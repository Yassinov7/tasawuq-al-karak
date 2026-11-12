import type { Tables } from "@/types/database";
import { appendProductMedia, newProductKey, validateProduct, type ProductForm, type ProductMediaDraft, type ProductValues } from "@/lib/merchant-product-create";
export type EditProductRecord = Pick<Tables<"products">,"id"|"store_id"|"title"|"description"|"category_id"|"price"|"selling_unit"|"minimum_quantity"|"quantity_step"|"is_available"|"updated_at">;
export type EditStoredMedia = Pick<Tables<"product_media">,"id"|"storage_path"|"media_type"|"display_order"|"alt_text">;
export type EditDraftMedia = ProductMediaDraft & { existing?: EditStoredMedia };
export function productEditForm(product: EditProductRecord): ProductForm {
  return {title:product.title,description:product.description,categoryId:product.category_id,price:String(product.price),unit:product.selling_unit,minimum:String(product.minimum_quantity),step:String(product.quantity_step),available:product.is_available};
}
export function validateProductEdit(form:ProductForm,categories:readonly {id:string}[],baseline:EditProductRecord) {
  const result=validateProduct(form,categories);
  if (form.categoryId === baseline.category_id) delete result.errors.categoryId;
  // Retain an existing legacy unit verbatim; never silently convert stored units.
  if(form.unit===baseline.selling_unit && form.unit.trim()) delete result.errors.unit;
  return result;
}
export function appendEditMedia(previous:EditDraftMedia[],incoming:EditDraftMedia[]) {
  appendProductMedia([],incoming.filter(item=>!item.existing));
  const combined=[...previous,...incoming];
  if(combined.filter(item=>item.type==='image').length>5 || combined.filter(item=>item.type==='video').length>1)throw new Error("الحد الإجمالي خمس صور وفيديو واحد؛ لم نُضف الاختيار الزائد.");
  return combined;
}
export type ProductEditAttempt = {
 version:1;id:string;ownerId:string;storeId:string;productId:string;form:ProductForm;values:ProductValues;
 baseline:EditProductRecord;baselineMedia:EditStoredMedia[];
 media:(EditDraftMedia & {rowId:string;path:string;displayOrder:number})[];
};
export function productEditAttempt(ownerId:string,baseline:EditProductRecord,original:EditStoredMedia[],form:ProductForm,media:EditDraftMedia[],categories:{id:string}[]):ProductEditAttempt {
 const {errors,numbers}=validateProductEdit(form,categories,baseline);
 if(Object.keys(errors).length)throw new Error("راجع الحقول المطلوبة.");
 appendEditMedia([],media);appendProductMedia([],media.filter(item=>!item.existing));
 const id=newProductKey();let nextOrder=Math.max(-1,...original.map(item=>item.display_order))+1;
 return {version:1,id,ownerId,storeId:baseline.store_id,productId:baseline.id,form:{...form},baseline:{...baseline},baselineMedia:original.map(item=>({...item})),
 values:{store_id:baseline.store_id,title:form.title.trim(),description:form.description.trim(),category_id:form.categoryId,price:numbers.price,selling_unit:form.unit,minimum_quantity:numbers.minimum,quantity_step:numbers.step},
 media:media.map(item=>{
  if(item.existing){
   const old=original.find(row=>row.id===item.existing?.id);
   if(!old || old.storage_path!==item.existing.storage_path || old.media_type!==item.type)throw new Error("تغيرت الوسائط الأصلية.");
   return {...item,existing:{...old},rowId:old.id,path:old.storage_path,displayOrder:old.display_order};
  }
  const rowId=newProductKey(),extension=item.mime==='image/jpeg'?'jpg':item.mime==='video/quicktime'?'mov':item.mime.split('/')[1];
  return {...item,rowId,path:`${baseline.store_id}/products/${baseline.id}/edits/${id}/${rowId}.${extension}`,displayOrder:nextOrder++};
 })};
}
export function editProductMatches(row:EditProductRecord|null,attempt:ProductEditAttempt) {
 return Boolean(row && row.id===attempt.productId && row.store_id===attempt.storeId && row.is_available===attempt.form.available && Object.entries(attempt.values).every(([key,value])=>row[key as keyof ProductValues]===value));
}
function baselineMatches(row:EditProductRecord,attempt:ProductEditAttempt) {
 return Object.keys(attempt.baseline).every(key=>row[key as keyof EditProductRecord]===attempt.baseline[key as keyof EditProductRecord]);
}
function mediaMatches(row:EditStoredMedia,item:ProductEditAttempt['media'][number]) {
 return row.id===item.rowId && row.storage_path===item.path && row.media_type===item.type && row.display_order===item.displayOrder;
}
export type ProductEditApi={
 persist:(attempt:ProductEditAttempt)=>Promise<void>;
 assertScope:(attempt:ProductEditAttempt)=>Promise<void>;
 category:(id:string)=>Promise<boolean>;
 product:(attempt:ProductEditAttempt)=>Promise<EditProductRecord|null>;
 update:(attempt:ProductEditAttempt)=>Promise<void>;
 media:(attempt:ProductEditAttempt)=>Promise<EditStoredMedia[]>;
 files:(attempt:ProductEditAttempt)=>Promise<{name:string;size:number;mime:string}[]>;
 upload:(item:ProductEditAttempt['media'][number])=>Promise<void>;
 removeLinks:(attempt:ProductEditAttempt,ids:string[])=>Promise<void>;
 link:(attempt:ProductEditAttempt,item:ProductEditAttempt['media'][number])=>Promise<void>;
};
export function createProductEditSaver(api:ProductEditApi) {
 let busy=false;
 return {isBusy:()=>busy,async save(attempt:ProductEditAttempt,progress:(message:string)=>void):Promise<boolean>{
  if(busy)return false;busy=true;
  try{
   await api.persist(attempt);await api.assertScope(attempt);
   if(attempt.values.category_id !== attempt.baseline.category_id && !await api.category(attempt.values.category_id))throw new Error("لم يعد التصنيف نشطًا.");
   let product=await api.product(attempt);
   if(!product)throw new Error("المنتج غير متاح لهذا المتجر.");
   if(!editProductMatches(product,attempt)){
    if(!baselineMatches(product,attempt))throw new Error("تغير المنتج من مصدر آخر؛ أعد التحقق قبل المتابعة.");
    progress("حفظ بيانات المنتج…");
    try{await api.update(attempt);}catch{/* Read back before considering another write. */}
    product=await api.product(attempt);
    if(!editProductMatches(product,attempt))throw new Error("تعذر تأكيد UPDATE.");
   }
   const added=attempt.media.filter(item=>!item.existing);
   for(const [index,item] of added.entries()){
    await api.assertScope(attempt);progress(`التحقق من الوسائط الجديدة ${index+1} / ${added.length}…`);
    let files=await api.files(attempt);const name=item.path.split('/').at(-1);
    if(!files.some(file=>file.name===name)){
     try{await api.upload(item);}catch{/* Reconcile the deterministic storage path. */}
     files=await api.files(attempt);
    }
    if(!files.some(file=>file.name===name&&file.size===item.size&&file.mime===item.mime))throw new Error("تعذر تأكيد رفع الوسائط.");
   }
   let rows=await api.media(attempt);
   const validateRows=()=>{
    if(rows.some(row=>!attempt.baselineMedia.some(old=>old.id===row.id&&old.storage_path===row.storage_path&&old.media_type===row.media_type&&old.display_order===row.display_order)&&!attempt.media.some(item=>mediaMatches(row,item))))throw new Error("تغيرت وسائط المنتج من مصدر آخر.");
    if(attempt.media.filter(item=>item.existing).some(item=>!rows.some(row=>mediaMatches(row,item))))throw new Error("إحدى الوسائط المحتفظ بها تغيرت أو لم تعد موجودة.");
   };
   validateRows();
   const removed=attempt.baselineMedia.filter(old=>!attempt.media.some(item=>item.rowId===old.id)).map(old=>old.id);
   const present=removed.filter(id=>rows.some(row=>row.id===id));
   if(present.length){
    await api.assertScope(attempt);progress("تأكيد إزالة الروابط المختارة…");
    try{await api.removeLinks(attempt,present);}catch{/* Confirm absence; never delete Storage objects. */}
    rows=await api.media(attempt);validateRows();
    if(rows.some(row=>removed.includes(row.id)))throw new Error("تعذر تأكيد إزالة روابط الوسائط.");
   }
   for(const item of added){
    if(!rows.some(row=>mediaMatches(row,item))){
     await api.assertScope(attempt);
     try{await api.link(attempt,item);}catch{/* Stable row ID prevents duplicate links. */}
     rows=await api.media(attempt);validateRows();
    }
    if(!rows.some(row=>mediaMatches(row,item)))throw new Error("تعذر تأكيد ربط الوسائط الجديدة.");
   }
   await api.assertScope(attempt);rows=await api.media(attempt);product=await api.product(attempt);
   if(!editProductMatches(product,attempt)||rows.length!==attempt.media.length||!attempt.media.every(item=>rows.some(row=>mediaMatches(row,item))))throw new Error("تعذر تأكيد النتيجة النهائية.");
   return true;
  }finally{busy=false;}
 }};
}
/** Last-request-wins gate shared by initial load and reference retries. */
export function createProductEditLoadGate(){let revision=0;return{begin(){const value=++revision;return()=>value===revision;},cancel(){revision++;}};}
