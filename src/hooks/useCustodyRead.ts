import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { C5ScopeError } from '@/lib/driver-custody-c5';
import { createFinancialReader, type FinancialReadState } from '@/lib/financial-reader';
type ScopedState<T>=FinancialReadState<T>&{scope:string};
/** Imperative reader lives outside render; an aborted old read cannot undo a newer permission denial. */
export function createCustodyReader<T>(scope:string,read:()=>Promise<T>,publish:(next:ScopedState<T>)=>void){
  let denied=false;
  return createFinancialReader(async()=>scope,async(_identity,signal)=>{
    try{const data=await read();if(!signal.aborted)denied=false;return data;}
    catch(cause){if(!signal.aborted&&cause instanceof C5ScopeError)denied=true;throw cause;}
  },next=>publish({...next,scope,data:denied?null:next.data}));
}
/** Scope-tagged state cannot display another account/page during a render. */
export function useCustodyRead<T>(scope:string,read:()=>Promise<T>){
  const [state,setState]=useState<ScopedState<T>|null>(null);
  const reader=useMemo(()=>createCustodyReader(scope,read,setState),[scope,read]);
  useFocusEffect(useCallback(()=>{reader.activate();void reader.load();return()=>reader.deactivate();},[reader]));
  const refresh=useCallback(()=>{void reader.load();},[reader]);
  return{data:state?.scope===scope&&!state.validating?state.data:null,loading:state?.scope!==scope||state.loading,error:state?.scope===scope?state.error:'',refresh};
}
