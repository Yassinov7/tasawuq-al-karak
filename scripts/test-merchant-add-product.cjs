// Offline tests: production validation and reconciler with isolated in-memory adapters.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function load(file,mocks={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Uint8Array,ArrayBuffer,Number,Date,Math,JSON,crypto:crypto.webcrypto,require(name){if(Object.hasOwn(mocks,name))return mocks[name];if(name==='@/lib/catalog-categories')return load('src/lib/catalog-categories.ts',mocks);if(name==='@/constants/selling-units')return load('src/constants/selling-units.ts');throw Error(name);}});
 return exports;
}
const m=load('src/lib/merchant-product-create.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const form=()=>({...m.emptyProductForm,title:'منتج صالح',categoryId:'cat',price:'1250.25'});
const image=(key='image')=>({key,uri:'file:///image.jpg',name:'image.jpg',type:'image',mime:'image/jpeg',size:3});
const video=()=>({...image('video'),uri:'file:///video.mp4',type:'video',mime:'video/mp4',duration:1000});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(media=[image()]) {
 const attempt=m.productAttempt('owner','store',form(),media,[{id:'cat'}]);
 let product=null,files=[],rows=[],stored=null;const calls=[];let current=true;
 const api={
  persist:async value=>{calls.push('persist');stored=plain(value);},
  assertScope:async()=>{calls.push('scope');if(!current)throw Error('changed account');},
  category:async()=>true,
  product:async()=>{calls.push('read product');return product;},
  insert:async value=>{calls.push('insert');if(product)throw Error('duplicate');product={id:value.id,...value.values,is_available:false};},
  files:async()=>{calls.push('read files');return files;},
  upload:async item=>{calls.push('upload');const name=item.path.split('/').at(-1);if(files.some(f=>f.name===name))throw Error('duplicate');files.push({name,size:item.size,mime:item.mime});},
  media:async()=>{calls.push('read links');return rows;},
  link:async(_a,item,index)=>{calls.push('link');if(rows.some(r=>r.id===item.rowId))throw Error('duplicate');rows.push({id:item.rowId,storage_path:item.path,display_order:index,media_type:item.type});},
  available:async value=>{calls.push('available');product.is_available=value.form.available;},
 };
 const saver=m.createProductSaver(api);
 return {attempt,api,saver,calls,get product(){return product;},get files(){return files;},get rows(){return rows;},get stored(){return stored;},changeAccount(){current=false;}};
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function fails(promise){let failed=false;try{await promise;}catch{failed=true;}assert.equal(failed,true);}
(async()=>{
 await test('valid product freezes real schema fields and has no currency choice',()=>{
  const h=harness();assert.equal(h.attempt.values.minimum_quantity,1);assert.equal(h.attempt.values.price,1250.25);assert.ok(!('currency' in h.attempt.values));
  const input=form(),attempt=m.productAttempt('owner','store',input,[image()],[{id:'cat'}]);input.title='changed';assert.equal(attempt.values.title,'منتج صالح');assert.equal(attempt.form.title,'منتج صالح');
 });
 await test('price and quantity precision and maxima reject silent rounding',()=>{
  assert.equal(m.parseProductNumber('999999999999.99',14,2),999999999999.99);assert.equal(m.parseProductNumber('999999999.999',12,3),999999999.999);
  for(const value of ['1.001','1000000000000','0','-1','Infinity','1e3','1.'])assert.throws(()=>m.parseProductNumber(value,14,2));
  assert.throws(()=>m.parseProductNumber('0.0001',12,3));
 });
 await test('Arabic/Persian digits and decimal separator, ambiguous commas rejected',()=>{
  assert.equal(m.parseProductNumber('١٢٣٫٤٥',14,2),123.45);assert.equal(m.parseProductNumber('۱۲۳.۴۵',14,2),123.45);
  for(const value of ['1,000','1,5','١٬٠٠٠','1،5','1 000'])assert.throws(()=>m.parseProductNumber(value,14,2));
 });
 await test('category is required and never auto-selected; approved units and text limits',()=>{
  assert.equal(m.emptyProductForm.categoryId,'');assert.ok(m.validateProduct({...form(),categoryId:''},[{id:'cat'}]).errors.categoryId);
  assert.ok(m.validateProduct({...form(),title:' a ',unit:'unknown',description:'x'.repeat(5001)},[{id:'cat'}]).errors.title);
  assert.ok(m.validateProduct({...form(),unit:'unknown'},[{id:'cat'}]).errors.unit);
 });
 await test('five images plus a video regardless of insertion order; no silent truncation',()=>{
  const images=Array.from({length:5},(_,i)=>image(String(i)));assert.equal(m.appendProductMedia([video()],images).length,6);
  assert.equal(m.appendProductMedia(images,[video()]).length,6);assert.throws(()=>m.appendProductMedia(images,[image('extra')]));assert.throws(()=>m.appendProductMedia([video()],[video()]));
 });
 await test('actual file headers, empty/oversized files, mismatched types',()=>{
  assert.equal(m.inspectProductMedia(new Uint8Array([255,216,255]),'image'),'image/jpeg');assert.throws(()=>m.inspectProductMedia(new Uint8Array([255,216,255]),'video'));
  assert.throws(()=>m.inspectProductMedia(new Uint8Array(0),'image'));assert.throws(()=>m.inspectProductMedia(new Uint8Array(m.maxMediaBytes+1),'image'));assert.throws(()=>m.inspectProductMedia(new Uint8Array([1,2,3]),'image'));
 });
 await test('success persists before writes and confirms values, links and availability',async()=>{
  const h=harness();assert.equal(await h.saver.save(h.attempt,()=>{}),true);assert.equal(h.calls[0],'persist');assert.equal(h.product.id,h.attempt.id);assert.equal(h.product.is_available,true);assert.equal(h.rows.length,1);assert.equal(h.stored.id,h.attempt.id);
 });
 await test('immediate duplicate click cannot save concurrently',async()=>{
  const h=harness(),gate=deferred();const persist=h.api.persist;h.api.persist=async a=>{await gate.promise;await persist(a);};
  const first=h.saver.save(h.attempt,()=>{});assert.equal(await h.saver.save(h.attempt,()=>{}),false);gate.resolve();await first;assert.equal(h.calls.filter(x=>x==='insert').length,1);assert.equal(h.saver.isBusy(),false);
 });
 await test('persistence failure blocks every remote write',async()=>{
  const h=harness();h.api.persist=async()=>{throw Error('disk');};await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.product,null);assert.equal(h.saver.isBusy(),false);
 });
 await test('lost INSERT acknowledgement reconciles without another product',async()=>{
  const h=harness(),insert=h.api.insert;h.api.insert=async a=>{await insert(a);throw Error('lost response');};assert.equal(await h.saver.save(h.attempt,()=>{}),true);assert.equal(h.calls.filter(x=>x==='insert').length,1);
 });
 await test('unverifiable INSERT stops; retry reads the same ID',async()=>{
  const h=harness(),insert=h.api.insert,read=h.api.product;let inserted=false;
  h.api.insert=async a=>{await insert(a);inserted=true;throw Error('timeout');};h.api.product=async()=>{if(inserted)throw Error('offline');return read();};
  await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.product.is_available,false);h.api.product=read;
  assert.equal(await h.saver.save(h.attempt,()=>{}),true);assert.equal(h.calls.filter(x=>x==='insert').length,1);
 });
 await test('failed INSERT without row retries the stable primary key',async()=>{
  const h=harness(),insert=h.api.insert;h.api.insert=async()=>{throw Error('offline');};await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.product,null);h.api.insert=insert;await h.saver.save(h.attempt,()=>{});assert.equal(h.product.id,h.attempt.id);
 });
 await test('partial upload resumes existing file and never deletes confirmed work',async()=>{
  const h=harness([image('a'),image('b')]),upload=h.api.upload;let tries=0;
  h.api.upload=async item=>{tries++;if(tries===2)throw Error('offline');return upload(item);};await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.files.length,1);assert.equal(h.rows.length,1);assert.equal(h.product.is_available,false);
  h.api.upload=upload;await h.saver.save(h.attempt,()=>{});assert.equal(h.files.length,2);assert.equal(h.calls.filter(x=>x==='insert').length,1);assert.equal(h.rows.length,2);
 });
 await test('lost upload/link acknowledgement reconciles deterministic path and row IDs',async()=>{
  const h=harness(),upload=h.api.upload,link=h.api.link;h.api.upload=async i=>{await upload(i);throw Error('lost');};h.api.link=async(...args)=>{await link(...args);throw Error('lost');};
  assert.equal(await h.saver.save(h.attempt,()=>{}),true);await h.saver.save(h.attempt,()=>{});assert.equal(h.files.length,1);assert.equal(h.rows.length,1);assert.equal(h.calls.filter(x=>x==='upload').length,1);
 });
 await test('failed linking keeps uploaded file for retry',async()=>{
  const h=harness(),link=h.api.link;h.api.link=async()=>{throw Error('offline');};await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.files.length,1);assert.equal(h.rows.length,0);h.api.link=link;await h.saver.save(h.attempt,()=>{});assert.equal(h.calls.filter(x=>x==='upload').length,1);
 });
 await test('lost activation response does not delete media or falsely fail confirmed state',async()=>{
  const h=harness(),available=h.api.available;h.api.available=async a=>{await available(a);throw Error('timeout');};assert.equal(await h.saver.save(h.attempt,()=>{}),true);assert.equal(h.files.length,1);assert.equal(h.product.is_available,true);
 });
 await test('inactive product choice is preserved',async()=>{
  const h=harness([]);h.attempt.form.available=false;assert.equal(await h.saver.save(h.attempt,()=>{}),true);assert.equal(h.product.is_available,false);
 });
 await test('category deactivation and changed account stop before writes',async()=>{
  const h=harness();h.api.category=async()=>false;await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.product,null);h.api.category=async()=>true;h.changeAccount();await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.product,null);
 });
 await test('mismatched stored product or file metadata stops activation',async()=>{
  const h=harness(),insert=h.api.insert;h.api.insert=async a=>{await insert(a);h.product.price=1;};await fails(h.saver.save(h.attempt,()=>{}));assert.equal(h.product.is_available,false);
  const f=harness();f.api.files=async()=>[{name:f.attempt.media[0].path.split('/').at(-1),size:99,mime:'image/jpeg'}];await fails(f.saver.save(f.attempt,()=>{}));assert.equal(f.product.is_available,false);
 });
 await test('durable attempt restore is account/store scoped; read failure never means empty',async()=>{
  const values=new Map();let fail=false;
  const storage={getItem:async key=>{if(fail)throw Error('disk unavailable');return values.get(key)??null;},setItem:async(key,value)=>values.set(key,value),removeItem:async key=>values.delete(key)};
  const a=load('src/lib/merchant-product-create-api.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'expo-file-system':{File:class {}},'@/lib/supabase':{supabase:{}},'@/lib/merchant-product-create':m});
  const h=harness(),api=a.createProductApi(()=>true);await api.persist(h.attempt);const restored=await a.readProductAttempt('owner','store');assert.equal(restored.id,h.attempt.id);assert.equal(await a.readProductAttempt('other','store'),null);
  fail=true;await fails(a.readProductAttempt('owner','store'));await fails(api.persist(h.attempt));fail=false;
  const key=[...values.keys()][0];values.set(key,'bad JSON');await fails(a.readProductAttempt('owner','store'));
 });
 await test('actual local file validation does not trust picker size or MIME',async()=>{
  let buffer=new Uint8Array([255,216,255]).buffer,size=3,reads=0;
  class File {get exists(){return true;}get size(){return size;}async arrayBuffer(){reads++;return buffer;}}
  const a=load('src/lib/merchant-product-create-api.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:{}},'expo-file-system':{File},'@/lib/supabase':{supabase:{}},'@/lib/merchant-product-create':m});
  const value=await a.inspectLocalProductMedia('file:///test','image');assert.equal(value.mime,'image/jpeg');assert.equal(value.size,3);
  size=m.maxMediaBytes+1;await fails(a.inspectLocalProductMedia('file:///test','image'));assert.equal(reads,1);size=3;buffer=new Uint8Array([1,2,3]).buffer;await fails(a.inspectLocalProductMedia('file:///test','image'));
 });
 await test('a different pending attempt cannot overwrite the recovery record',async()=>{
  let text=null;const storage={getItem:async()=>text,setItem:async(_key,value)=>{text=value;}};
  const a=load('src/lib/merchant-product-create-api.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'expo-file-system':{File:class {}},'@/lib/supabase':{supabase:{}},'@/lib/merchant-product-create':m});
  const api=a.createProductApi(()=>true),one=harness().attempt,two=harness().attempt;await api.persist(one);await fails(api.persist(two));assert.equal(JSON.parse(text).id,one.id);
 });
 await test('explicit discard never forgets an uncertain row and never deletes remote data',async()=>{
  let text=null,removed=0;const storage={getItem:async()=>text,setItem:async(_key,value)=>{text=value;},removeItem:async()=>{text=null;removed++;}};
  const a=load('src/lib/merchant-product-create-api.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'expo-file-system':{File:class {}},'@/lib/supabase':{supabase:{}},'@/lib/merchant-product-create':m});
  const h=harness(),persistent=a.createProductApi(()=>true);await persistent.persist(h.attempt);
  assert.equal(await a.abandonProductAttempt(h.attempt,()=>true,h.api),false);assert.equal(removed,0);
  const read=h.api.product;h.api.product=async()=>{throw Error('offline');};await fails(a.abandonProductAttempt(h.attempt,()=>true,h.api));assert.equal(removed,0);h.api.product=read;
  await h.saver.save(h.attempt,()=>{});assert.equal(await a.abandonProductAttempt(h.attempt,()=>true,h.api),true);assert.equal(removed,1);assert.equal(h.product.id,h.attempt.id);assert.equal(h.files.length,1);
 });
 await test('navigation decisions cover clean, dirty and in-flight state',()=>{
  assert.equal(m.productExitDecision(false,false),'leave');assert.equal(m.productExitDecision(true,false),'confirm');assert.equal(m.productExitDecision(true,true),'busy');assert.equal(m.productExitDecision(false,true),'busy');
  const ui=fs.readFileSync('src/components/merchant/MerchantAddProduct.tsx','utf8');assert.ok(ui.includes('usePreventRemove'));assert.ok(ui.includes('hardwareBackPress'));assert.ok(ui.includes('navigation.dispatch(data.action)'));assert.ok(ui.includes('router.canGoBack()'));assert.ok(ui.includes('allowExit.current=true'));
 });
 await test('late reference reads are fenced and do not overwrite entered category',()=>{
  const ui=fs.readFileSync('src/components/merchant/MerchantAddProduct.tsx','utf8');assert.ok(ui.includes('request === sequence.current'));assert.ok(ui.includes('if (!restoredStore.current)'));assert.ok(!ui.includes('options[0]'));assert.ok(!ui.includes('categories[0]'));
 });
 await test('shared route delegates to separate add/edit savers without creating in edit',()=>{
  const route=fs.readFileSync('src/app/merchant/product-editor.tsx','utf8');assert.ok(route.includes('<MerchantEditProduct key={'));assert.ok(route.includes('<MerchantAddProduct key={user.id}'));
  const edit=fs.readFileSync('src/lib/merchant-product-edit-api.ts','utf8');assert.ok(edit.includes('from("products").update('));assert.ok(!edit.includes('from("products").insert('));assert.ok(!edit.includes('createProductSaver'));
 });
 await test('catalogue invalidation happens only after confirmed creation; no compensating deletes',()=>{
  const ui=fs.readFileSync('src/components/merchant/MerchantAddProduct.tsx','utf8'),api=fs.readFileSync('src/lib/merchant-product-create-api.ts','utf8');
  assert.ok(ui.includes('invalidateMerchantHome(ownerId)'));assert.ok(ui.includes('merchant-products:${ownerId}'));assert.ok(ui.includes('refreshProductAvailability(snapshot.id)'));assert.ok(ui.indexOf('if (!saved) return;')<ui.indexOf('await clearProductAttempt(snapshot)'));assert.ok(!api.includes('.delete('));assert.ok(!api.includes('.remove('));
 });
 console.log(passed+' add-product tests passed (offline)');
})().catch(error=>{console.error(error);process.exitCode=1;});
