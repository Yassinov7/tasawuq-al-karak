import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {createAccountGate} from '@/lib/personal-account-model';
import {useAuth} from '@/context/AuthContext';
import {readPersonalAccount,type PersonalAccount} from '@/lib/personal-account';
export function usePersonalAccount(){
 const {user}=useAuth();const owner=user?.id;
 const [state,setState]=useState<{owner?:string;data:PersonalAccount|null;error:string;loading:boolean}>({data:null,error:'',loading:true});
 const gate=useRef(createAccountGate()),abort=useRef<AbortController|null>(null),focused=useRef(false);
 const load=useCallback(async()=>{
  const token=gate.current.next();abort.current?.abort();const c=new AbortController();abort.current=c;
  if(!owner){setState({owner,data:null,error:'سجّل الدخول لعرض الحساب.',loading:false});return;}
  setState(p=>({owner,data:p.owner===owner?p.data:null,error:'',loading:true}));
  try{const data=await readPersonalAccount(owner,c.signal);if(focused.current&&gate.current.valid(token)&&!c.signal.aborted)setState({owner,data,error:'',loading:false});}
  catch{if(focused.current&&gate.current.valid(token)&&!c.signal.aborted)setState(p=>({owner,data:p.owner===owner?p.data:null,error:'تعذر تحميل الحساب. أعد المحاولة.',loading:false}));}
 },[owner]);
 useFocusEffect(useCallback(()=>{focused.current=true;void load();return()=>{focused.current=false;gate.current.cancel();abort.current?.abort();};},[load]));
 const valid=state.owner===owner;
 return {owner,data:valid?state.data:null,error:valid?state.error:'',loading:!valid||state.loading,reload:load};
}
