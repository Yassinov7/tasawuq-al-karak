export type ToastTone="success"|"error"|"warning"|"info";
export type ToastInput={message:string;tone:ToastTone;key?:string};
export type ToastNotice=ToastInput&{id:number};
/** One transient notice, no stacking; stale screen/account callbacks cannot notify a new scope. */
export function createToastStore(publish:(notice:ToastNotice|null)=>void,clock=()=>Date.now()){
 let scope:unknown=null,serial=0,timer:ReturnType<typeof setTimeout>|undefined;
 const recent=new Map<string,number>();
 const dismiss=()=>{clearTimeout(timer);timer=undefined;publish(null);};
 return{
  dismiss,
  setScope(next:unknown){scope=next;recent.clear();dismiss();},
  show(input:ToastInput,expectedScope:unknown){
   if(scope===null||expectedScope!==scope||!input.message.trim())return false;
   const key=input.key??`${input.tone}:${input.message}`,now=clock();
   if(now-(recent.get(key)??-Infinity)<10000)return false;
   recent.set(key,now);if(recent.size>60)recent.delete(recent.keys().next().value!);
   clearTimeout(timer);const id=++serial;publish({...input,id});
   const base=input.tone==="success"?3500:input.tone==="info"?4500:6500;
   timer=setTimeout(dismiss,Math.max(base,Math.min(8000,input.message.length*55)));return true;
  }
 };
}
