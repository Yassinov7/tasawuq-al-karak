import {readLocalCache,writeLocalCache,invalidateLocalCache} from '@/lib/local-cache';
import {validFinancialId} from '@/lib/financial-input';
import {newIdempotencyKey} from '@/lib/driver-cash';
type Reply={data:unknown;error:unknown};
/** Durable frozen intent shared by financial commands. Timeout is never proof of rollback. */
export function createDurableFinancialOperation<I,R extends {state:string}>(config:{namespace:string;normalize:(v:I)=>I;scopeFor:(v:I)=>string;decode:(raw:unknown,input:I)=>R;owner:(actor:string)=>Promise<void>;recover:(actor:string,key:string)=>Promise<Reply>;send:(actor:string,key:string,input:I)=>Promise<Reply>}){
 type Intent={owner:string;key:string;input:I};const locks=new Set<string>(),keyFor=(actor:string,scope:string)=>`${config.namespace}:${actor}:${scope}`;
 async function saved(actor:string,scope:string){const i=await readLocalCache<Intent>(keyFor(actor,scope),{requirePersistence:true});if(i){if(i.owner!==actor||config.scopeFor(config.normalize(i.input))!==scope)throw Error('المحاولة لا تخص هذه الصفحة.');validFinancialId(i.key);}return i;}
 async function restore(actor:string,scope:string){await config.owner(actor);const i=await saved(actor,scope);await config.owner(actor);return i?.input;}
 async function finish(actor:string,scope:string){const k=keyFor(actor,scope);if(locks.has(k))throw Error('العملية قيد التنفيذ.');locks.add(k);try{await config.owner(actor);const i=await saved(actor,scope);if(!i)return;const r=await config.recover(actor,i.key);await config.owner(actor);if(r.error||config.decode(r.data,i.input).state==='unknown')throw Error('تحقق من المحاولة قبل عملية مستقلة.');await invalidateLocalCache(k,{requirePersistence:true});}finally{locks.delete(k);}}
 async function run(actor:string,scope:string,input?:I,readOnly=false):Promise<R>{
  const k=keyFor(actor,scope);if(locks.has(k))throw Error('العملية المالية قيد التنفيذ.');locks.add(k);
  try{
   await config.owner(actor);const normalized=input?config.normalize(input):undefined;if(normalized&&config.scopeFor(normalized)!==scope)throw Error('العملية لا تخص هذه الصفحة.');let i=await saved(actor,scope);
   if(i){const r=await config.recover(actor,i.key);await config.owner(actor);if(r.error)return config.decode({state:'unknown'},i.input);const found=config.decode(r.data,i.input);if(found.state!=='unknown'||readOnly)return found;if(normalized&&JSON.stringify(normalized)!==JSON.stringify(i.input))throw Error('هناك محاولة غير محسومة بمدخلات أخرى.');}
   else{if(readOnly)return config.decode({state:'unknown'},normalized as I);if(!normalized)throw Error('لا توجد محاولة محفوظة.');i={owner:actor,key:newIdempotencyKey(),input:normalized};}
   await writeLocalCache(k,i,{requirePersistence:true});await config.owner(actor);let r=await config.send(actor,i.key,i.input);await config.owner(actor);if(r.error)r=await config.recover(actor,i.key);await config.owner(actor);return config.decode(r.error?{state:'unknown'}:r.data,i.input);
  }finally{locks.delete(k);}
 }
 return{restore,finish,run};
}
