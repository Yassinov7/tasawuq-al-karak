import type {BrandingAsset,BrandingAttempt,BrandingKind} from './store-branding-contract';
export type BrandingSelection={uri:string;mime:string;size:number;kind:BrandingKind};
export type BrandingFlowState={current:BrandingAsset[];pending:BrandingAttempt|null;selected:BrandingSelection|null;busy:boolean;ready:boolean;error:string;notice:string};
type Api={read:()=>Promise<BrandingAsset[]>;resume:()=>Promise<{attempt:BrandingAttempt;asset:BrandingAsset|null}|null>;register:(a:BrandingAttempt)=>Promise<unknown>;upload:(a:BrandingAttempt,b:ArrayBuffer)=>Promise<unknown>;publish:(a:BrandingAttempt)=>Promise<BrandingAsset|void>;remove:(id:string)=>Promise<unknown>;cancel:(a:BrandingAttempt)=>Promise<unknown>;finish:(a:BrandingAttempt)=>Promise<unknown>;bytes:(s:BrandingSelection)=>Promise<ArrayBuffer>;id:()=>string};
/** Scope-fenced workflow. No automatic retry of an upload or a publication. */
export function createBrandingFlow(owner:string,store:string,api:Api){
 let state:BrandingFlowState={current:[],pending:null,selected:null,busy:false,ready:false,error:'',notice:''};
 let active=false,generation=0,locked=false;const listeners=new Set<(s:BrandingFlowState)=>void>();
 const patch=(v:Partial<BrandingFlowState>)=>{state={...state,...v};listeners.forEach(fn=>fn(state));};
 const guard=(g:number)=>{if(!active||g!==generation)throw Error('stale');};
 async function refresh(g:number){const current=await api.read();guard(g);const recovery=await api.resume();guard(g);let pending=recovery?.attempt??null;if(recovery?.asset?.is_current||recovery?.asset?.state==='retired'){await api.finish(recovery.attempt);guard(g);pending=null;}patch({current:current.map(asset=>state.current.find(previous=>previous.id===asset.id&&previous.storage_path===asset.storage_path)??asset),pending,ready:true});}
 async function refreshConfirmed(g:number){try{await refresh(g);}catch{guard(g);patch({error:'تم تنفيذ العملية، لكن تعذر تحديث العرض. حدّث الحالة دون تكرار الرفع.'});}}
 async function run(task:(g:number)=>Promise<void>){if(locked||!active)return;locked=true;const g=generation;patch({busy:true,error:'',notice:''});try{await task(g);}catch(failure){if(active&&g===generation)patch({error:failure instanceof Error&&failure.message.startsWith('حجم الملف')?failure.message:'تعذر تأكيد النتيجة. تحقق من الاتصال والجلسة وصلاحية المتجر. حدّث الحالة قبل المحاولة؛ لن نكرر الرفع تلقائيًا.'});}finally{locked=false;if(active){if(g!==generation)void run(refresh);else patch({busy:false});}}}
 return {
 get state(){return state;},subscribe(fn:(s:BrandingFlowState)=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
 async activate(){active=true;generation++;if(locked)return;await run(refresh);},deactivate(){active=false;generation++;patch({busy:false});},
 select(selected:BrandingSelection|null){if(!locked&&!state.pending&&state.ready)patch({selected,error:'',notice:''});},
 async save(){if(!state.selected||state.pending||!state.ready)return;const selected={...state.selected};await run(async g=>{const bytes=await api.bytes(selected);guard(g);const attempt:BrandingAttempt={owner,store,id:api.id(),kind:selected.kind,mime:selected.mime,size:selected.size,expectedCurrent:state.current.find(a=>a.kind===selected.kind)?.id??null};patch({pending:attempt});await api.register(attempt);guard(g);await api.upload(attempt,bytes);guard(g);const published=await api.publish(attempt);guard(g);patch({current:published?[...state.current.filter(asset=>asset.kind!==published.kind),published]:state.current,pending:null,selected:null,notice:'تم حفظ وسيط المتجر.'});try{await refresh(g);}catch{guard(g);patch({error:'تم الحفظ، لكن تعذر تحديث العرض. حدّث الحالة.',notice:'تم الحفظ بنجاح.'});}});},
 async reconcile(){if(!state.pending)return;const a=state.pending;await run(async g=>{await api.register(a);guard(g);const published=await api.publish(a);guard(g);patch({current:published?[...state.current.filter(asset=>asset.kind!==published.kind),published]:state.current,pending:null,selected:null,notice:'تم تأكيد نشر الوسيط.'});await refreshConfirmed(g);});},
 async cancel(){if(!state.pending)return;const a=state.pending;await run(async g=>{await api.cancel(a);guard(g);patch({pending:null,selected:null,notice:'تم إغلاق المحاولة. تمت إزالة مرجعها إذا كان متاحًا لهذا الحساب.'});await refreshConfirmed(g);});},
 async remove(id:string){if(state.pending)return;await run(async g=>{await api.remove(id);guard(g);patch({current:state.current.filter(asset=>asset.id!==id),notice:'تمت إزالة الوسيط من المتجر.'});await refreshConfirmed(g);});}
 };
}
