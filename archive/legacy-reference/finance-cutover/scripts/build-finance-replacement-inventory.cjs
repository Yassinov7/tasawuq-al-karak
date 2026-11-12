// Read-only source inventory; writes documentation only. Never connects to a database.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const norm = value => value.replaceAll('\\', '/');
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => {
    const file = norm(path.join(dir, e.name));
    return e.isDirectory() ? walk(file) : [file];
  });
}
const files = walk('src').filter(f => /\.(ts|tsx)$/.test(f));
const known = new Set(files);
const financialName = /(?:finance|financial|subscription|settlement|custody|wage|ledger|wallet|commission|treasury|credit|invoice|payment)/i;
const mixed = new Set([
  'src/lib/c3-orders.ts','src/lib/c3-order-contract.ts','src/lib/store-pickups.ts',
  'src/lib/driver-cash.ts','src/lib/driver-deliveries.ts','src/lib/driver-collection.ts',
  'src/lib/delivery-collection-attempt.ts','src/lib/legacy-delivery-collection.ts',
]);
const shared = new Set([
  'src/lib/money.ts','src/components/ui/DocumentReference.tsx','src/components/ui/OperationFeedback.tsx',
]);
const imports = {};
for (const file of files) {
  const s = fs.readFileSync(path.join(root, file), 'utf8');
  const source = ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true);
  imports[file] = [];
  for (const n of source.statements) {
    if (!(ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) || !n.moduleSpecifier || !ts.isStringLiteral(n.moduleSpecifier)) continue;
    const spec = n.moduleSpecifier.text;
    const base = spec.startsWith('@/') ? 'src/' + spec.slice(2) : spec.startsWith('.') ? norm(path.join(path.dirname(file), spec)) : null;
    if (!base) continue;
    const resolved = [base, base+'.ts', base+'.tsx', base+'/index.ts', base+'/index.tsx'].find(x => known.has(x));
    if (resolved) imports[file].push(resolved);
  }
}
const seeds = new Set(files.filter(f => financialName.test(f) || mixed.has(f)));
const affected = new Set([...seeds, ...shared]);
let change = true;
while (change) {
  change = false;
  for (const f of files) if (!affected.has(f) && imports[f].some(d => affected.has(d))) { affected.add(f); change = true; }
}
const sourceFiles = files.map(file => ({
  file,
  action: mixed.has(file) ? 'EXTRACT_OPERATIONAL_REPLACE_FINANCE' : shared.has(file) ? 'KEEP_GENERIC_REVIEW_CONTRACT' : seeds.has(file) ? 'REPLACE_OLD_IMPLEMENTATION' : affected.has(file) ? 'KEEP_PATCH_INTEGRATION' : 'KEEP_BASELINE_REGRESSION',
  imports: imports[file],
  directDependents: files.filter(f => imports[f].includes(file)),
  literalRpcCalls: [...fs.readFileSync(path.join(root,file),'utf8').matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]),
  literalTableReads: [...fs.readFileSync(path.join(root,file),'utf8').matchAll(/\.from\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]),
}));
const operational = new Set([
  'profiles','merchant_applications','driver_applications','merchants','stores','audit_logs',
  'product_categories','products','product_media','store_offers','store_offer_products','store_offer_media',
  'store_categories','notifications','delivery_zones','customer_carts','customer_cart_items','customer_cart_store_notes',
  'customer_orders','store_orders','store_order_items','store_order_totals','customer_order_totals',
  'store_order_status_history','delivery_tasks','customer_addresses','customer_cart_offer_selections',
  'store_reviews','product_reviews','store_branding_assets',
]);
const operationalRebuild = new Set([
  'order_lifecycle_events','order_pricing_snapshots','order_pricing_current','order_pricing_revisions',
  'customer_order_requests','delivery_pickup_workflows','delivery_store_pickups','delivery_collection_results',
]);
const planRebuild = new Set(['subscription_plans','merchant_subscriptions']);
const migrations = fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort().map(file=>{
 const text=fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8');
 const tables=[...text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)].map(m=>{
  const name=m[1],short=name.split('.').at(-1);
  return {name,action:operational.has(short)?'KEEP_OPERATIONAL':operationalRebuild.has(short)?'REBUILD_OPERATIONAL_WITHOUT_OLD_FINANCE':planRebuild.has(short)?'REPLACE_WITH_SIMPLE_TERMS':'REMOVE_OLD_FINANCE_AFTER_REPLACEMENT'};
 });
 const declarations=[];
 for (const m of text.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:(?:constraint|unique)\s+)?(function|view|trigger|index|sequence|type|policy)\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)) declarations.push({kind:m[1].toLowerCase(),name:m[2],line:text.slice(0,m.index).split('\n').length});
 return {file:'supabase/migrations/'+file,tables,declarations};
});
const relatedFiles=[...walk('scripts'),...walk('supabase/tests'),...walk('supabase/verification'),...walk('docs')]
 .filter(f=>!f.includes('finance-replacement-inventory') && f!=='docs/simple-finance-spec.ar.md' && financialName.test(f));
const data={date:'2026-11-09',sourceOnly:true,databaseConnected:false,deletionExecuted:false,
 limitations:['Static import closure and lexical SQL declaration inventory only.','Not a live pg_depend/RLS/trigger/cron inventory; overloaded function signatures and dynamic SQL require live inspection.','Source action classifications are implementation candidates, not authorization to delete entire files.','Related test/document list is name-based; operational tests must be preserved or rewritten, never discarded solely by name.'],
 summary:{sourceFiles:files.length,replacementCandidates:sourceFiles.filter(x=>x.action==='REPLACE_OLD_IMPLEMENTATION').length,mixedModules:mixed.size,affectedSourceFiles:affected.size,migrations:migrations.length,declaredTables:migrations.reduce((a,m)=>a+m.tables.length,0)},
 sourceFiles,migrations,relatedTestAndDocumentationCandidates:relatedFiles};
fs.writeFileSync(path.join(root,'docs/finance-replacement-inventory.json'),JSON.stringify(data,null,2)+'\n');
let md='# جرد استبدال الماليات — ملحق مصدر آلي\n\nتاريخ الجرد: 9 نوفمبر 2026. لا اتصال بقاعدة البيانات ولا حذف منفذ.\n\n';
md+='هذا فهرس مصدر، وليس نتيجة pg_depend أو سجلًا لما هو منشور. التصنيف يحكم التنفيذ القديم داخل الملف، وليس إذنًا بحذف الملف كاملًا. تفاصيل الاستيرادات والتبعيات المباشرة وتصريحات SQL في JSON المرافق.\n\n';
const labels={REPLACE_OLD_IMPLEMENTATION:'استبدال التنفيذ المالي القديم',EXTRACT_OPERATIONAL_REPLACE_FINANCE:'مختلط: استخراج التشغيل واستبدال الماليات',KEEP_GENERIC_REVIEW_CONTRACT:'حفظ الوظيفة العامة ومراجعة العقد',KEEP_PATCH_INTEGRATION:'حفظ مع إصلاح نقاط التكامل',KEEP_BASELINE_REGRESSION:'حفظ واختبار عدم التأثر'};
for(const [action,label] of Object.entries(labels)) {md+='## '+label+'\n\n';for(const row of sourceFiles.filter(x=>x.action===action))md+='- `'+row.file+'`\n';md+='\n';}
md+='## جداول المصدر بحسب القرار\n\n';
for(const migration of migrations.filter(x=>x.tables.length)){md+='### '+path.basename(migration.file)+'\n\n';for(const t of migration.tables)md+='- `'+t.name+'`: '+t.action+'\n';md+='\n';}
md+='## اختبارات ووثائق مرشحة للتحديث أو الإحالة التاريخية\n\n';
for(const f of relatedFiles)md+='- `'+f+'`\n';
fs.writeFileSync(path.join(root,'docs/finance-replacement-inventory.ar.md'),md);
console.log(JSON.stringify(data.summary,null,2));
