import { isSelectableCategory } from "@/lib/catalog-categories";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { getMerchantStore, getStoreMediaUrl } from "@/lib/merchant-store";
import { inspectLocalProductMedia } from "@/lib/merchant-product-create-api";
import { createProductEditSaver, productEditForm, validateProductEdit, type EditDraftMedia, type ProductEditApi, type ProductEditAttempt } from "@/lib/merchant-product-edit";
import { appendProductMedia } from "@/lib/merchant-product-create";
const key=(ownerId:string,storeId:string,productId:string)=>`@tasawuq/product-edit/syp-v1/${ownerId}/${storeId}/${productId}`;
export async function loadEditableProduct(ownerId:string,productId:string,signal?:AbortSignal){
 const store=await getMerchantStore(ownerId);
 if(!store)throw new Error("Store unavailable");
 let query=supabase.from("products").select("id,store_id,title,description,category_id,price,selling_unit,minimum_quantity,quantity_step,is_available,updated_at").eq("id",productId).eq("store_id",store.id);
 if(signal)query=query.abortSignal(signal);
 const product=await query.maybeSingle();
 if(product.error||!product.data)throw new Error("Product unavailable");
 let mediaQuery=supabase.from("product_media").select("id,storage_path,media_type,display_order,alt_text").eq("product_id",productId).eq("store_id",store.id).order("display_order").order("id");
 if(signal)mediaQuery=mediaQuery.abortSignal(signal);
 const media=await mediaQuery;
 if(media.error)throw media.error;
 const originals=media.data??[];
 const draft:EditDraftMedia[]=originals.map(item=>({key:item.id,uri:getStoreMediaUrl(item.storage_path),name:item.alt_text||(item.media_type==='image'?'صورة المنتج':'فيديو المنتج'),type:item.media_type,mime:'',size:0,existing:item}));
 return{store,product:product.data,form:productEditForm(product.data),originals,media:draft};
}
export async function readProductEditAttempt(ownerId:string,storeId:string,productId:string):Promise<ProductEditAttempt|null>{
 const text=await AsyncStorage.getItem(key(ownerId,storeId,productId));if(!text)return null;
 const attempt=JSON.parse(text) as ProductEditAttempt;
 if(attempt.version!==1||attempt.ownerId!==ownerId||attempt.storeId!==storeId||attempt.productId!==productId||attempt.baseline?.id!==productId||attempt.baseline.store_id!==storeId||!attempt.id||!attempt.form||!attempt.values||!Array.isArray(attempt.media)||!Array.isArray(attempt.baselineMedia))throw new Error("Invalid edit recovery record");
 const validation=validateProductEdit(attempt.form,[{id:attempt.form.categoryId}],attempt.baseline);
 if(Object.keys(validation.errors).length||attempt.values.store_id!==storeId||attempt.values.category_id!==attempt.form.categoryId||attempt.values.title!==attempt.form.title.trim()||attempt.values.description!==attempt.form.description.trim()||attempt.values.selling_unit!==attempt.form.unit||attempt.values.price!==validation.numbers.price||attempt.values.minimum_quantity!==validation.numbers.minimum||attempt.values.quantity_step!==validation.numbers.step||typeof attempt.form.available!=='boolean')throw new Error("Invalid edit values");
 if(attempt.media.filter(item=>item.type==='image').length>5||attempt.media.filter(item=>item.type==='video').length>1)throw new Error("Invalid media count");
 appendProductMedia([],attempt.media.filter(item=>!item.existing));
 for(const item of attempt.media){
  if(item.existing){const old=attempt.baselineMedia.find(row=>row.id===item.rowId);if(!old||old.storage_path!==item.path||old.media_type!==item.type||old.display_order!==item.displayOrder)throw new Error("Invalid retained media");}
  else if(!item.path.startsWith(`${storeId}/products/${productId}/edits/${attempt.id}/`)||!item.rowId||!Number.isInteger(item.displayOrder))throw new Error("Invalid new media");
 }
 return attempt;
}
export async function clearProductEditAttempt(attempt:ProductEditAttempt){
 const saved=await readProductEditAttempt(attempt.ownerId,attempt.storeId,attempt.productId);
 if(saved&&saved.id!==attempt.id)throw new Error("Another edit is pending");
 if(saved)await AsyncStorage.removeItem(key(attempt.ownerId,attempt.storeId,attempt.productId));
}
export function createProductEditApi(isCurrent:()=>boolean):ProductEditApi{
 const current=()=>{if(!isCurrent())throw new Error("Screen changed");};
 return{
  async persist(attempt){current();const previous=await readProductEditAttempt(attempt.ownerId,attempt.storeId,attempt.productId);if(previous&&previous.id!==attempt.id)throw new Error("Another edit is pending");await AsyncStorage.setItem(key(attempt.ownerId,attempt.storeId,attempt.productId),JSON.stringify(attempt));},
  async assertScope(attempt){
   current();const session=await supabase.auth.getSession();if(session.error||session.data.session?.user.id!==attempt.ownerId)throw new Error("Account changed");
   const store=await getMerchantStore(attempt.ownerId);current();if(store?.id!==attempt.storeId)throw new Error("Store changed");
  },
  async category(id){current();return isSelectableCategory("product", id);},
  async product(attempt){
   current();const result=await supabase.from("products").select("id,store_id,title,description,category_id,price,selling_unit,minimum_quantity,quantity_step,is_available,updated_at").eq("id",attempt.productId).eq("store_id",attempt.storeId).maybeSingle();
   if(result.error)throw result.error;return result.data;
  },
  async update(attempt){
   current();const result=await supabase.from("products").update({...attempt.values,is_available:attempt.form.available}).eq("id",attempt.productId).eq("store_id",attempt.storeId).eq("updated_at",attempt.baseline.updated_at).select("id").single();
   if(result.error||!result.data)throw result.error??new Error("Unconfirmed UPDATE");
  },
  async media(attempt){current();const result=await supabase.from("product_media").select("id,storage_path,media_type,display_order,alt_text").eq("product_id",attempt.productId).eq("store_id",attempt.storeId).order("display_order").order("id");if(result.error)throw result.error;return result.data??[];},
  async files(attempt){current();const result=await supabase.storage.from("store-media").list(`${attempt.storeId}/products/${attempt.productId}/edits/${attempt.id}`,{limit:100});if(result.error)throw result.error;return(result.data??[]).map(file=>({name:file.name,size:Number(file.metadata?.size),mime:String(file.metadata?.mimetype??'')}));},
  async upload(item){current();const actual=await inspectLocalProductMedia(item.uri,item.type);current();if(actual.size!==item.size||actual.mime!==item.mime)throw new Error("File changed");const result=await supabase.storage.from("store-media").upload(item.path,actual.buffer,{contentType:item.mime,upsert:false});if(result.error)throw result.error;},
  async removeLinks(attempt,ids){
   for(const id of ids){
    current();const old=attempt.baselineMedia.find(item=>item.id===id);if(!old)throw new Error("Unknown original media");
    const result=await supabase.from("product_media").delete().eq("product_id",attempt.productId).eq("store_id",attempt.storeId).eq("id",id).eq("storage_path",old.storage_path).eq("display_order",old.display_order).eq("media_type",old.media_type);
    if(result.error)throw result.error;
   }
  },
  async link(attempt,item){current();const result=await supabase.from("product_media").insert({id:item.rowId,product_id:attempt.productId,store_id:attempt.storeId,storage_path:item.path,media_type:item.type,display_order:item.displayOrder,alt_text:item.name.slice(0,180)});if(result.error)throw result.error;},
 };
}
export function createProductEditSession(){let active=false;return{saver:createProductEditSaver(createProductEditApi(()=>active)),activate(){active=true;},deactivate(){active=false;}};}
/** Discard only ends local tracking after the owned product can be located. */
export async function abandonProductEditAttempt(attempt:ProductEditAttempt,isCurrent:()=>boolean){const api=createProductEditApi(isCurrent);await api.assertScope(attempt);if(await api.product(attempt))await clearProductEditAttempt(attempt);}
