const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){
 const exports={};const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,Date,Intl,Number,BigInt,AbortController,Set,Map,JSON,setTimeout,clearTimeout,require(name){if(Object.hasOwn(mocks,name))return mocks[name];if(name==='@react-native-async-storage/async-storage')return{default:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}};if(name==='@/lib/driver-cash')return{newIdempotencyKey:()=> '00000000-0000-4000-8000-000000000001'};if(name.startsWith('@/lib/'))return load(`src/lib/${name.slice(6)}.ts`,mocks);throw Error(`Unmocked import ${name}`);}});return exports;
}
module.exports={load};
