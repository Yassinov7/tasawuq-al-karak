const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,mocks={}){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:name=>{if(!(name in mocks))throw Error('Unmocked '+name);return mocks[name];}});return exports;}
async function main(){
 const {createDialogQueue}=load('src/lib/dialog-queue.ts');let visible;
 const queue=createDialogQueue(request=>{visible=request;});
 const first=queue.show({title:'Leave?',message:'Unsaved'}),firstId=visible.id,second=queue.show({title:'Second',message:'Waiting'});
 assert.equal(visible.title,'Leave?');queue.settle(firstId,false);assert.equal(await first,false);const secondId=visible.id;
 queue.settle(firstId,true);assert.equal(visible.id,secondId,'Double tap must not accept the following dialog');
 queue.cancelAll();assert.equal(await second,false);assert.equal(visible,null);
 const third=queue.show({title:'Confirm',message:'Action'});queue.settle(visible.id,true);assert.equal(await third,true);
 console.log('PASS branded dialog queue: cancel, confirm, ordering, stale/double confirmation and navigation cancellation');
 const {keyboardFormLayout,focusedFieldScroll}=load('src/lib/keyboard-visibility.ts');
 const overlay=keyboardFormLayout(80,720,500),resized=keyboardFormLayout(80,420,500);
 assert.equal(overlay.overlap,300);assert.equal(resized.overlap,0);assert.equal(overlay.visibleBottom,resized.visibleBottom);
 assert.equal(focusedFieldScroll(0,100,80,80,440),0);
 assert.equal(focusedFieldScroll(0,430,70,80,440),60);
 assert.equal(focusedFieldScroll(200,50,70,80,440),158);
 assert.equal(focusedFieldScroll(0,100,600,80,440),8,'Tall field aligns its top rather than overscrolling');
 assert.equal(focusedFieldScroll(0,20,70,80,440),0);
 console.log('PASS keyboard positioning: overlay/resize equivalence, field below keyboard, field above viewport, tall field and nonnegative scroll');
 let back,confirmResolve,confirmCount=0,navigation=0,dismissed=0,keyboardOpen=false;
 const {useOnboardingExit}=load('src/hooks/useOnboardingExit.ts',{
  react:{useCallback:f=>f,useRef:initial=>({current:initial})},
  'react-native':{BackHandler:{addEventListener:(_event,callback)=>{back=callback;return{remove(){}};}},Keyboard:{dismiss(){dismissed++;keyboardOpen=false;},isVisible:()=>keyboardOpen}},
  'expo-router':{useRouter:()=>({replace(){navigation++;}}),useFocusEffect:f=>f()},
  '@/context/AppDialogContext':{useAppDialog:()=>({confirm(){confirmCount++;return new Promise(resolve=>{confirmResolve=resolve;});}})},
 });
 const exit=useOnboardingExit({dirty:true,busy:false});exit();exit();assert.equal(confirmCount,1);confirmResolve(false);await new Promise(r=>setImmediate(r));assert.equal(navigation,0);
 exit();confirmResolve(true);await new Promise(r=>setImmediate(r));assert.equal(navigation,1);
 useOnboardingExit({dirty:true,busy:true})();assert.equal(confirmCount,2);
 useOnboardingExit({dirty:false,busy:false});keyboardOpen=true;back();assert(dismissed>0);assert.equal(navigation,1,'Back with keyboard visible only dismisses it');back();assert.equal(navigation,2);
 console.log('PASS real onboarding exit hook: cancel retains form, confirm leaves once, busy blocks, Android back dismisses keyboard first');
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
 for(const f of walk('src').filter(f=>/\.(ts|tsx)$/.test(f)))assert(!/\bAlert\.alert\s*\(|\bwindow\.confirm\s*\(/.test(fs.readFileSync(f,'utf8')),f+' contains native alert');
 console.log('PASS product source has no native Alert.alert or browser confirm calls');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
