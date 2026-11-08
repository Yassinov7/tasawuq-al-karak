import AsyncStorage from "@react-native-async-storage/async-storage";
import {supabase} from "@/lib/supabase";
import {readProductIdentity} from "@/lib/merchant-product-create-api";
import {createOfferSaver,offerUnits,type OfferAttempt,type OfferLoaded,type OfferProduct,type OfferSaveApi} from "@/lib/merchant-offer-editor";
const offerColumns="id,store_id,title,description,offer_type,discount_method,discount_value,bundle_price,starts_at,ends_at,is_active,updated_at";
const productColumns="id,title,price,selling_unit,minimum_quantity,quantity_step,is_available";
export const offerProductsPageSize=30;
export const offerAttemptKey=(ownerId:string,storeId:string,offerId:string|null)=>`@tasawuq/offer-editor/syp-v1/${ownerId}/${storeId}/${offerId??'new'}`;
export async function readOfferProducts(storeId:string,search:string,cursor:string|null,signal?:AbortSignal){
 let query=supabase.from('products').select(productColumns).eq('store_id',storeId).eq('is_available',true).order('id').limit(offerProductsPageSize);
 if(search.trim())query=query.ilike('title',`%${search.trim().replace(/[\\%_]/g,'\\$&')}%`);
 if(cursor)query=query.gt('id',cursor);if(signal)query=query.abortSignal(signal);
 const result=await query;if(result.error)throw result.error;return result.data??[];
}
export async function readSelectedOfferProducts(storeId:string,ids:string[],signal?:AbortSignal):Promise<OfferProduct[]>{
 const unique=[...new Set(ids)],products:OfferProduct[]=[];
 for(let offset=0;offset<unique.length;offset+=80){
  const chunk=unique.slice(offset,offset+80);let cursor:string|null=null;
  while(true){let query=supabase.from('products').select(productColumns).eq('store_id',storeId).in('id',chunk).order('id').limit(80);if(cursor)query=query.gt('id',cursor);if(signal)query=query.abortSignal(signal);
   const result=await query;if(result.error)throw result.error;const rows=result.data??[];if(!rows.length)break;products.push(...rows);cursor=rows[rows.length-1].id;
  }
 }
 return products;
}
export async function readMerchantOffer(storeId:string,id:string,signal?:AbortSignal):Promise<OfferLoaded>{
 let query=supabase.from('store_offers').select(offerColumns).eq('id',id).eq('store_id',storeId);if(signal)query=query.abortSignal(signal);
 const result=await query.maybeSingle();if(result.error||!result.data)throw new Error('Offer unavailable');
 const items:OfferLoaded['items']=[];let cursor:string|null=null;
 while(true){let itemQuery=supabase.from('store_offer_products').select('id,product_id,item_role,quantity').eq('offer_id',id).eq('store_id',storeId).order('id').limit(80);if(cursor)itemQuery=itemQuery.gt('id',cursor);if(signal)itemQuery=itemQuery.abortSignal(signal);
  const itemResult=await itemQuery;if(itemResult.error)throw itemResult.error;const rows=itemResult.data??[];if(!rows.length)break;items.push(...rows);cursor=rows[rows.length-1].id;
 }
 const products=await readSelectedOfferProducts(storeId,items.map(item=>item.product_id),signal);
 return{offer:result.data,items,products};
}
export async function readOfferAttempt(ownerId:string,storeId:string,offerId:string|null):Promise<OfferAttempt|null>{
 const text=await AsyncStorage.getItem(offerAttemptKey(ownerId,storeId,offerId));if(!text)return null;
 const attempt=JSON.parse(text) as OfferAttempt;
 if(attempt.version!==1||attempt.ownerId!==ownerId||attempt.storeId!==storeId||attempt.offerId!==offerId||!['sending','unknown','known'].includes(attempt.status)||!attempt.form||!attempt.args||attempt.args.selected_offer!==offerId||!Array.isArray(attempt.args.input_items)||!Array.isArray(attempt.form.items)||typeof attempt.args.input_title!=='string'||typeof attempt.args.input_description!=='string'||!['discount','bundle','buy_x_get_y'].includes(attempt.args.input_type)||typeof attempt.args.input_is_active!=='boolean'||!(attempt.args.input_ends_at===null||typeof attempt.args.input_ends_at==='string'))throw new Error('Invalid recovery record');
 const form=attempt.form;
 if(form.selectedEndInstant!==undefined&&(typeof form.selectedEndInstant!=='string'||!Number.isFinite(Date.parse(form.selectedEndInstant))))throw new Error('Invalid selected expiration instant');
 if(['title','description','discountValue','bundlePrice','endDate','endTime'].some(field=>typeof form[field as keyof typeof form]!=='string')||!['discount','bundle','buy_x_get_y'].includes(form.type)||!['percentage','fixed_amount'].includes(form.discountMethod)||!['keep','none','new'].includes(form.endMode)||typeof form.active!=='boolean'||!(form.originalEndsAt===null||typeof form.originalEndsAt==='string')||form.items.some(item=>typeof item.key!=='string'||typeof item.productId!=='string'||typeof item.quantity!=='string'||!['discounted','bundle','buy','reward'].includes(item.role)))throw new Error('Invalid recovery form');
 for(const raw of attempt.args.input_items){if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.product_id!=='string'||!['discounted','bundle','buy','reward'].includes(String(raw.item_role))||typeof raw.quantity!=='number')throw new Error('Invalid recovery items');offerUnits(String(raw.quantity),12,3);}
 if(offerId&&(!attempt.baseline||attempt.baseline.offer.id!==offerId||attempt.baseline.offer.store_id!==storeId))throw new Error('Invalid edit baseline');
 if(attempt.resultId!==null&&typeof attempt.resultId!=='string')throw new Error('Invalid result ID');
 return attempt;
}
export async function clearOfferAttempt(attempt:OfferAttempt){
 const saved=await readOfferAttempt(attempt.ownerId,attempt.storeId,attempt.offerId);
 if(saved&&JSON.stringify(saved.args)!==JSON.stringify(attempt.args))throw new Error('Another attempt is pending');
 if(saved)await AsyncStorage.removeItem(offerAttemptKey(attempt.ownerId,attempt.storeId,attempt.offerId));
}
export function createOfferSaveApi(isCurrent:()=>boolean):OfferSaveApi{
 const current=()=>{if(!isCurrent())throw new Error('Screen/account changed');};
 return{
  // Account/store-scoped local metadata may finish after blur to retain a returned ID.
  // Remote reads/writes below remain fenced by the active session.
  async persist(attempt){const old=await readOfferAttempt(attempt.ownerId,attempt.storeId,attempt.offerId);if(old&&JSON.stringify(old.args)!==JSON.stringify(attempt.args))throw new Error('Another attempt is pending');await AsyncStorage.setItem(offerAttemptKey(attempt.ownerId,attempt.storeId,attempt.offerId),JSON.stringify(attempt));},
  clear:clearOfferAttempt,
  async scope(attempt){current();const session=await supabase.auth.getSession();if(session.error||session.data.session?.user.id!==attempt.ownerId)throw new Error('Account changed');const store=await readProductIdentity(attempt.ownerId);current();if(store.id!==attempt.storeId)throw new Error('Store changed');},
  async read(storeId,id){current();const data=await readMerchantOffer(storeId,id);current();return data;},
  async rpc(args){current();const result=await supabase.rpc('save_store_offer',args);return{data:result.data,error:result.error};},
 };
}
export function createOfferEditorSession(){let active=false;return{saver:createOfferSaver(createOfferSaveApi(()=>active)),activate(){active=true;},deactivate(){active=false;}};}
