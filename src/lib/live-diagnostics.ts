// Bounded, in-memory diagnostics: no tokens, filters, IDs, payloads or raw server messages.
type LiveDiagnostic={at:number;scope:string;event:string;cause:"none"|"timeout"|"heartbeat"|"bindings"|"authorization"|"other"};
const events:LiveDiagnostic[]=[];
export function recordLiveDiagnostic(channelName:string,event:string,error?:unknown){
 const message=error&&typeof error==="object"&&"message" in error&&typeof error.message==="string"?error.message:"";
 const cause:LiveDiagnostic["cause"]=/heartbeat/i.test(message)?"heartbeat":/mismatch.*binding/i.test(message)?"bindings":/permission|unauthor|JWT|token/i.test(message)?"authorization":event==="TIMED_OUT"||/timeout/i.test(message)?"timeout":message?"other":"none";
 const prefix=channelName.split(":")[0];
 const scope=["notifications","customer-orders","customer-order","driver-delivery-tasks","driver-assigned-deliveries","driver-task-details","merchant-home","merchant-orders","admin-home","admin-orders","money","invoice","application-status"].includes(prefix)?prefix:"other";
 events.push({at:Date.now(),scope,event:["SUBSCRIBED","CHANNEL_ERROR","TIMED_OUT","CLOSED","CREATED","REMOVED"].includes(event)?event:"OTHER",cause});
 if(events.length>80)events.shift();
}
export function readLiveDiagnostics(){return events.map(event=>({...event}));}
