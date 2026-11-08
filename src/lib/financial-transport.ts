/** A timeout is UNKNOWN: it does not cancel/negate a possibly committed server write. */
export type FinancialRpcReply={data:unknown;error:{message:string;code?:string}|null};
export function createFinancialTransport<Rpc extends string>(api:{rpc(name:Rpc,args:Record<string,unknown>):PromiseLike<FinancialRpcReply>},timeoutMs=15000){
  return async(name:Rpc,args:Record<string,unknown>):Promise<FinancialRpcReply>=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([
      Promise.resolve().then(()=>api.rpc(name,args)),
      new Promise<FinancialRpcReply>(resolve=>{timer=setTimeout(()=>resolve({data:null,error:{message:'unknown RPC timeout'}}),timeoutMs);}),
    ]);}catch{return{data:null,error:{message:'unknown RPC result'}};}
    finally{if(timer!==undefined)clearTimeout(timer);}
  };
}
