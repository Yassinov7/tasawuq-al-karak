import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { checkBrandingSignature, validateBrandingInput, type BrandingAsset, type BrandingAttempt } from '@/lib/store-branding-contract';

// Dedicated REST boundary: no casts or invented RPCs in the generated Database type.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const apiKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;
const key = (owner: string) => `store-media:v2:native:${owner}`;
const locks = new Set<string>();
function attemptSnapshot(a:BrandingAttempt):BrandingAttempt{return Object.freeze({owner:a.owner,id:a.id,store:a.store,kind:a.kind,mime:a.mime,size:a.size,expectedCurrent:a.expectedCurrent});}
async function session(owner?: string) {
 const { data, error } = await supabase.auth.getSession();
 if (error || !data.session || (owner && data.session.user.id !== owner)) throw new Error('Account changed');
 return data.session;
}
async function request(path: string, body?: object, owner?: string): Promise<unknown> {
 const s = await session(owner);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try {
 const response = await fetch(`${url}/rest/v1/${path}`, { signal:controller.signal, method: body ? 'POST' : 'GET', headers: { apikey: apiKey, Authorization: `Bearer ${s.access_token}`, 'Content-Type':'application/json' }, ...(body ? {body:JSON.stringify(body)} : {}) });
 const result=response.status===204?null:await response.json();
 await session(s.user.id);
 if (!response.ok) throw new Error('Branding operation not confirmed; read its status before retrying');
 return result;
 } finally {clearTimeout(timer);}
}
function asset(value: unknown): BrandingAsset {
 if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !('storage_path' in value) || typeof value.storage_path !== 'string' || !('state' in value) || !['registered','current','retired'].includes(String(value.state)) || !('store_id' in value) || typeof value.store_id !== 'string' || !('is_current' in value) || typeof value.is_current !== 'boolean') throw new Error('Invalid branding response');
 return value as BrandingAsset;
}
export async function readBrandingAttempt(a: BrandingAttempt) {
 a=attemptSnapshot(a);
 const rows = await request(`store_branding_assets?id=eq.${encodeURIComponent(a.id)}&store_id=eq.${encodeURIComponent(a.store)}&select=*`, undefined, a.owner);
 if (!Array.isArray(rows)) throw new Error('Invalid status response');
 if(rows.length>1) throw new Error('Ambiguous asset response');
 const row=rows.length?asset(rows[0]):null;
 if(row && (row.id!==a.id||row.store_id!==a.store||row.kind!==a.kind||row.mime_type!==a.mime||row.byte_size!==a.size)) throw new Error('Attempt contract mismatch');
 return row;
}
export async function resumeBrandingAttempt(store:string): Promise<{attempt:BrandingAttempt; asset:BrandingAsset|null}|null> {
 const s = await session(); const raw = await AsyncStorage.getItem(key(s.user.id));
 await session(s.user.id);
 if (!raw) return null;
 const a=attemptSnapshot(JSON.parse(raw));
 validateBrandingInput(a.kind,a.mime,a.size);
 if (a.owner !== s.user.id || a.store !== store) throw new Error('Attempt owner mismatch');
 if(raw!==JSON.stringify(a))await AsyncStorage.setItem(key(s.user.id),JSON.stringify(a));
 return {attempt:a,asset:await readBrandingAttempt(a)};
}
export async function registerBranding(a: BrandingAttempt) {
 a=attemptSnapshot(a);
 const lock = `register:${a.owner}`;
 if (locks.has(lock)) throw new Error('Attempt busy'); locks.add(lock);
 try {
 validateBrandingInput(a.kind,a.mime,a.size); await session(a.owner);
 const previous = await AsyncStorage.getItem(key(a.owner));
 if (previous && previous !== JSON.stringify(a)) throw new Error('Resolve the existing attempt first');
 await AsyncStorage.setItem(key(a.owner),JSON.stringify(a));
 return asset(await request('rpc/register_store_branding',{asset_id:a.id,target_store:a.store,asset_kind:a.kind,asset_mime:a.mime,asset_bytes:a.size},a.owner));
 } finally { locks.delete(lock); }
}
export async function uploadBranding(a: BrandingAttempt, bytes: ArrayBuffer) {
 a=attemptSnapshot(a); bytes=bytes.slice(0);
 if (locks.has(a.id)) throw new Error('Attempt busy'); locks.add(a.id);
 try {
  validateBrandingInput(a.kind,a.mime,bytes.byteLength);
  checkBrandingSignature(a.mime,bytes);
  if(bytes.byteLength!==a.size) throw new Error('File changed');
  const registered = await readBrandingAttempt(a);
  if(!registered || registered.state!=='registered') throw new Error('Attempt not uploadable');
  await session(a.owner);
  const sentKey=key(a.owner)+':upload:'+a.id;
  if(await AsyncStorage.getItem(sentKey)) throw new Error('Upload already attempted; reconcile the same registered path');
  await AsyncStorage.setItem(sentKey,JSON.stringify({id:a.id,store:a.store}));
  await session(a.owner);
  // A timeout is an UNKNOWN upload result; the durable upload-intent marker remains.
  const operation=supabase.storage.from(a.kind==='logo'?'store-logos':'store-videos').upload(registered.storage_path,bytes,{contentType:a.mime,upsert:false});
  let deadline:ReturnType<typeof setTimeout>|undefined;
  const {error}=await Promise.race([operation,new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Upload unconfirmed')),120000);})]).finally(()=>clearTimeout(deadline));
  await session(a.owner);
  if(error) throw new Error(/size|large|exceed|413/i.test(error.message)?'حجم الملف يتجاوز حد الحاوية أو الحد العام لمشروع Supabase. ألغِ المحاولة واختر ملفًا أصغر.':'تعذر تأكيد الرفع. تحقّق من المحاولة نفسها قبل إعادة الرفع.');
 } finally {locks.delete(a.id);}
}
export async function publishBranding(a:BrandingAttempt) {
 a=attemptSnapshot(a);
 if(locks.has(a.id)) throw new Error('Attempt busy'); locks.add(a.id);
 try {
 
 // Reconcile first after a timeout; an already-current asset needs no replay.
 const current=await readBrandingAttempt(a);
 if(current?.is_current) { await finishBrandingAttempt(a); return current; }
 if(current?.state!=='registered') throw new Error('Attempt not publishable');
 try { await request('rpc/publish_store_branding',{asset_id:a.id,expected_current:a.expectedCurrent},a.owner); } catch { /* Read the same ID before deciding whether the result is unknown. */ }
 const confirmed=await readBrandingAttempt(a);
 if(!confirmed?.is_current) throw new Error('Publication unconfirmed');
 await finishBrandingAttempt(a);
 return confirmed;
 } finally {locks.delete(a.id);}
}
export async function unpublishBranding(owner:string,id:string) {
 try { await request('rpc/unpublish_store_branding',{asset_id:id},owner); } catch { /* Reconcile the reference after a lost acknowledgement. */ }
 const rows=await request(`store_branding_assets?id=eq.${encodeURIComponent(id)}&select=*`,undefined,owner);
 if(!Array.isArray(rows)||rows.length!==1||asset(rows[0]).state!=='retired') throw new Error('Unpublish unconfirmed');
}
export async function readCurrentBranding(store:string) {
 const rows=await request(`store_branding_assets?store_id=eq.${encodeURIComponent(store)}&is_current=eq.true&select=*`);
 if(!Array.isArray(rows)) throw new Error('Invalid branding response');
 const result=rows.map(asset);
 if(result.some(a=>a.store_id!==store||!a.is_current||a.state!=='current')) throw new Error('Current asset scope mismatch');
 return result;
}
export async function brandingDisplayUrl(a:BrandingAsset) {
 // Memory-only return value; caller must discard at expiry and on account change.
 if(!a.is_current||a.state!=='current') throw new Error('Unpublished asset');
 const s=await session(); const ttl=a.kind==='logo'?60:600; const expiresAt=Date.now()+ttl*1000-5000;
 const {data,error}=await supabase.storage.from(a.kind==='logo'?'store-logos':'store-videos').createSignedUrl(a.storage_path,ttl);
 await session(s.user.id);
 if(error||!data) throw new Error('Cannot sign branding URL');
 return {url:data.signedUrl,expiresAt};
}
/** Clear only a server-confirmed terminal attempt; never erase an uncertain upload. */
export async function finishBrandingAttempt(a:BrandingAttempt) {
 a=attemptSnapshot(a);
 const lock=`register:${a.owner}`;
 if(locks.has(lock)) throw new Error('Attempt busy');locks.add(lock);
 try {
 const row=await readBrandingAttempt(a);
 if(!row || (!row.is_current && row.state!=='retired')) throw new Error('Attempt still unresolved');
 await session(a.owner);
 const stored=await AsyncStorage.getItem(key(a.owner));
 await session(a.owner);
 if(stored && JSON.parse(stored).id===a.id) { await AsyncStorage.removeItem(key(a.owner)); await AsyncStorage.removeItem(key(a.owner)+':upload:'+a.id); }
 } finally {locks.delete(lock);}
}

/** Explicit cancellation also handles registration that never reached the server. No file is deleted. */
export async function cancelBrandingAttempt(a:BrandingAttempt){
 a=attemptSnapshot(a);const row=await readBrandingAttempt(a);
 if(row){await unpublishBranding(a.owner,a.id);await finishBrandingAttempt(a);return;}
 await session(a.owner);const stored=await AsyncStorage.getItem(key(a.owner));await session(a.owner);
 if(stored&&JSON.parse(stored).id===a.id){await AsyncStorage.removeItem(key(a.owner));await AsyncStorage.removeItem(key(a.owner)+':upload:'+a.id);}
}
