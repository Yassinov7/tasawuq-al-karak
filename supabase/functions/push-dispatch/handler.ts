type Delivery = { id:string; notification_id:string; lease:string; ticket:string|null; token:string };
type Outcome = "retry"|"ticket"|"sent"|"dead"|"device_gone";
type Settings = { url:string; serviceKey:string; dispatchSecret:string; expoAccessToken?:string };
type Result = {status?:string;id?:string;details?:{error?:string}};

/** Service-only worker. Payloads deliberately contain no names, addresses or financial amounts. */
export function createPushDispatcher(settings:Settings, request:typeof fetch=fetch) {
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  const response=await request(`${settings.url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:settings.serviceKey,Authorization:`Bearer ${settings.serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error("Queue unavailable");
  return response.status===204?null:response.json();
 };
 const expo=async(path:string,body:unknown)=>{
  const response=await request(`https://exp.host/--/api/v2/push/${path}`,{method:"POST",headers:{"Content-Type":"application/json",...(settings.expoAccessToken?{Authorization:`Bearer ${settings.expoAccessToken}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error("Push service unavailable");
  return response.json();
 };
 return async(req:Request):Promise<Response>=>{
  if(!settings.dispatchSecret||req.headers.get("Authorization")!==`Bearer ${settings.dispatchSecret}`)return new Response("Unauthorized",{status:401});
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  let completed=0,failed=false;
  try{
   await rpc("reconcile_push_deliveries",{});
   const deliveries:Delivery[]=await rpc("claim_push_deliveries",{batch_limit:10});
   // Bounded concurrency keeps the worker within its time limit; DB leases isolate overlapping ticks.
   for(let offset=0;offset<deliveries.length;offset+=5){const outcomes=await Promise.allSettled(deliveries.slice(offset,offset+5).map(async item=>{
    const allowed=await rpc("authorize_push_delivery",{delivery_value:item.id,lease_value:item.lease});
    if(allowed!==true){await rpc("finish_push_delivery",{delivery_value:item.id,lease_value:item.lease,result_kind:"dead",ticket_value:null,error_value:"ReadOrDeviceInactive"});completed++;return;}
    let kind:Outcome="retry",ticket:string|null=null,error:string|null=null;
    try{
     let result:Result|undefined;
     if(item.ticket){
      const reply=await expo("getReceipts",{ids:[item.ticket]});result=reply.data?.[item.ticket];
      if(result?.status==="ok")kind="sent";
     }else{
      const reply=await expo("send",{to:item.token,title:"تسوق",body:"لديك تحديث جديد. افتح التطبيق لمراجعته.",data:{notificationId:item.notification_id},sound:"default",channelId:"operations",collapseId:item.notification_id,tag:item.notification_id,ttl:86400});
      result=Array.isArray(reply.data)?reply.data[0]:reply.data;
      if(result?.status==="ok"&&typeof result.id==="string"){kind="ticket";ticket=result.id;}
     }
     if(result?.status==="error"){
      const code=result.details?.error;
      error=typeof code==="string"&&["DeviceNotRegistered","MessageTooBig","InvalidCredentials","MessageRateExceeded","MismatchSenderId"].includes(code)?code:"PushRejected";
      kind=error==="DeviceNotRegistered"?"device_gone":["MessageTooBig","InvalidCredentials"].includes(error)?"dead":"retry";
     }
    }catch{error="TransportUnavailable";}
    // A failed completion leaves a lease, not a claimed success. Unknown HTTP outcomes can be retried.
    await rpc("finish_push_delivery",{delivery_value:item.id,lease_value:item.lease,result_kind:kind,ticket_value:ticket,error_value:error});completed++;
   }));if(outcomes.some(outcome=>outcome.status==="rejected"))failed=true;}
   return Response.json({processed:completed},{status:failed?503:200});
  }catch{return Response.json({error:"Dispatch incomplete",processed:completed},{status:503});}
 };
}
