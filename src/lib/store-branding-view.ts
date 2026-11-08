/** Display URLs remain memory-only and must never outlive their conservative deadline. */
export function brandingLinkRemaining(expiresAt:number,now=Date.now()){return Math.max(0,expiresAt-now);}
export function attachBrandingPlayback(player:{pause:()=>void;addListener:(event:'statusChange',listener:(event:{status:string})=>void)=>{remove:()=>void}},onError:()=>void){
 const subscription=player.addListener('statusChange',event=>{if(event.status==='error')onError();});
 return()=>{subscription.remove();try{player.pause();}catch{/* Native player may already be released. */}};
}
