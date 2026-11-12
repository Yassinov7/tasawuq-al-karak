export type LiveState = "connecting" | "live" | "disconnected" | "paused";
/** Native SDK owns transient reconnects. We replace only closed or persistently stuck channels. */
export function startLiveUpdates(options: {
 foreground:boolean;
 sdkManagedRecovery?:boolean;
 listen:(event:()=>void,status:(value:string)=>void)=>()=>void;
 watchApp:(changed:(foreground:boolean)=>void)=>()=>void;
 refresh:()=>void|Promise<void>;
 status:(value:LiveState)=>void;
}) {
 let active=true,foreground=options.foreground,epoch=0,attempt=0,joined=false;
 let stopChannel:(()=>void)|undefined;
 let refreshTimer:ReturnType<typeof setTimeout>|undefined,retryTimer:ReturnType<typeof setTimeout>|undefined;
 let retryClosed=false;
 let reading:object|null=null,dirty=false,lastState:LiveState|undefined;
 const report=(state:LiveState)=>{if(lastState!==state){lastState=state;options.status(state);}};
 const clearTimers=()=>{clearTimeout(refreshTimer);clearTimeout(retryTimer);refreshTimer=retryTimer=undefined;dirty=false;};
 const schedule=()=>{
  if(!active||!foreground)return;
  if(reading){dirty=true;return;}
  if(refreshTimer)return;
  refreshTimer=setTimeout(()=>{
   refreshTimer=undefined;
   if(!active||!foreground)return;
   const job={},token=epoch;reading=job;
   void Promise.resolve().then(()=>{if(active&&foreground&&token===epoch)return options.refresh();}).catch(()=>undefined).finally(()=>{
    if(reading!==job)return;
    reading=null;if(dirty){dirty=false;schedule();}
   });
  },350);
 };
 const disconnect=()=>{epoch++;joined=false;reading=null;dirty=false;const previous=stopChannel;stopChannel=undefined;previous?.();};
 const retry=(closed:boolean)=>{
  if(retryTimer&&(!closed||retryClosed))return;
  clearTimeout(retryTimer);retryClosed=closed;
  // Let the SDK rejoin after transient errors. No competing 5-second channel churn.
  const delay=closed?Math.min(5000*2**attempt,60000):Math.min(60000*2**attempt,300000);
  retryTimer=setTimeout(()=>{retryTimer=undefined;attempt++;connect();},delay);
 };
 const connect=()=>{
  if(!active||!foreground)return;
  clearTimers();disconnect();const token=epoch;
  if(lastState!=="disconnected")report("connecting");
  try{
   stopChannel=options.listen(()=>{if(active&&token===epoch)schedule();},value=>{
    if(!active||token!==epoch)return;
    if(value==="SUBSCRIBED"){
     clearTimeout(retryTimer);retryTimer=undefined;attempt=0;
     if(joined)return;
     joined=true;report("live");schedule();
    }else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(value)){
     joined=false;report("disconnected");
     if(!options.sdkManagedRecovery || (value==="CLOSED" && attempt===0))retry(value==="CLOSED");
    }
   });
  }catch{report("disconnected");if(!options.sdkManagedRecovery || attempt===0)retry(true);}
 };
 const stopApp=options.watchApp(next=>{
  if(!active||next===foreground)return;
  foreground=next;
  if(foreground){attempt=0;connect();}else{clearTimers();disconnect();report("paused");}
 });
 if(foreground)connect();else report("paused");
 return()=>{active=false;clearTimers();disconnect();stopApp();};
}

/** Order and duplicate bindings do not change the effective subscription. */
export function liveSubscriptionSignature(entries:readonly {table:string;filter?:string}[]){
 const unique=new Map(entries.map(item=>[JSON.stringify([item.table,item.filter??""]),{table:item.table,...(item.filter?{filter:item.filter}:{})}]));
 return JSON.stringify([...unique.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value));
}
