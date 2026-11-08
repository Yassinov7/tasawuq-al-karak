import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';

/** Shared policy/payout operation UX. Scope-tagged state and durable terminal intents survive remounts. */
export function useFinancialOperation<I,R>(actor:string,scope:string,onRefresh:()=>void,api:{restore:(actor:string,scope:string)=>Promise<I|undefined>;run:(actor:string,scope:string,input?:I,readOnly?:boolean)=>Promise<R>;finish:(actor:string,scope:string)=>Promise<void>}){
 const identity=`${actor}:${scope}`,current=useRef(''),lock=useRef(false);
 useLayoutEffect(()=>{current.current=identity;return()=>{current.current='';};},[identity]);
 const [state,setState]=useState<{identity:string;frozen?:I;result?:R;error:string}>({identity:'',error:''});
 const [busy,setBusy]=useState(false);
 useFocusEffect(useCallback(()=>{let active=true;if(actor)void api.restore(actor,scope).then(frozen=>{if(active&&current.current===identity)setState(previous=>({... (previous.identity===identity?previous:{error:''}),identity,frozen}));}).catch(()=>{if(active&&current.current===identity)setState({identity,error:'تعذر قراءة المحاولة المحفوظة؛ لا تبدأ عملية مستقلة قبل التحقق.'});});return()=>{active=false;};},[actor,scope,identity,api]));
 const run=async(input?:I,readOnly=false)=>{
  if(!actor||lock.current||current.current!==identity)return undefined;lock.current=true;setBusy(true);
  try{const result=await api.run(actor,scope,input,readOnly);if(current.current!==identity)return undefined;const frozen=await api.restore(actor,scope);if(current.current!==identity)return undefined;setState({identity,frozen,result,error:''});onRefresh();return result;}
  catch(cause){if(current.current===identity){let frozen:I|undefined;try{frozen=await api.restore(actor,scope);}catch{/* Keep the durable unknown attempt. */}if(current.current===identity)setState(previous=>({... (previous.identity===identity?previous:{error:''}),identity,frozen:frozen??(previous.identity===identity?previous.frozen:undefined),error:cause instanceof Error?cause.message:'تعذر التحقق من العملية.'}));}return undefined;}
  finally{lock.current=false;setBusy(false);}
 };
 const finish=async()=>{if(!actor||lock.current||current.current!==identity)return;lock.current=true;setBusy(true);try{await api.finish(actor,scope);if(current.current===identity)setState({identity,error:''});}catch(cause){if(current.current===identity)setState(previous=>({...previous,error:cause instanceof Error?cause.message:'تحقق من المحاولة.'}));}finally{lock.current=false;setBusy(false);}};
 return{...(state.identity===identity?state:{error:'',frozen:undefined,result:undefined}),busy,run,finish};
}
