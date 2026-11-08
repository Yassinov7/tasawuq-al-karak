// Offline schema projection for the new migration. Regenerate against a local
// PostgreSQL instance once available; this never contacts the linked project.
const fs=require('node:fs');
const dir='supabase/migrations';
const sql=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')&&!f.includes('syp_only')).sort().map(f=>fs.readFileSync(`${dir}/${f}`,'utf8').replace(/\r/g,'')).join('\n');
const dbFile='src/types/database.ts';let db=fs.readFileSync(dbFile,'utf8');
const removed=new Set(['products','store_offers','subscription_plans','delivery_zones','wallets','merchant_credit_limits']);
db=db.replace(/"SYP"\s*\|\s*"USD"/g,'"SYP"').replace(/\["SYP", "USD"\]/g,'["SYP"]');
for(const table of removed){
 const start=db.indexOf(`      ${table}: {`);if(start<0)continue;
 const next=db.slice(start+1).search(/\n      [a-z_]+: \{/),end=next<0?db.indexOf('\n    Views:',start):start+1+next;
 let block=db.slice(start,end).replace(/^          currency\??:.*\n/gm,'');
 if(['wallets','merchant_credit_limits'].includes(table))block=block.replace(/isOneToOne: false/g,'isOneToOne: true');
 db=db.slice(0,start)+block+db.slice(end);
}
db=db.replace(/^          (?:input_currency|target_currency|payment_currency|credit_currency|remittance_currency|payout_currency|report_currency|selected_currency)\??:.*\n/gm,'')
 .replace(/columns: \["user_id", "currency"\]/g,'columns: ["user_id"]').replace(/referencedColumns: \["user_id", "currency"\]/g,'referencedColumns: ["user_id"]').replace(/wallet_transactions_user_id_currency_fkey/g,'wallet_transactions_user_id_fkey');
db=db.replace(/Insert: \{[\s\S]*?\n        \}/g,block=>block.replace(/(          (?:currency|currency_snapshot|plan_currency_snapshot|delivery_currency)):/g,'$1?:'));
function split(s){let depth=0,quote=false,out=[],a=0;for(let i=0;i<s.length;i++){if(s[i]==="'"){if(quote&&s[i+1]==="'"){i++;continue;}quote=!quote;continue;}if(!quote){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(s[i]===','&&depth===0){out.push(s.slice(a,i).trim());a=i+1}}}out.push(s.slice(a).trim());return out;}
function type(t){if(t==='public.currency_code')return '"SYP"';if(/^(numeric|integer|bigint|smallint)/.test(t))return 'number';if(t==='boolean')return 'boolean';if(t==='jsonb'||t==='json')return 'Json';if(t.endsWith('[]'))return `${type(t.slice(0,-2))}[]`;return 'string';}
let additions='';
for(const m of sql.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g)){
 const name=m[1];if(db.includes(`      ${name}: {`))continue;
 const cols=split(m[2].replace(/--[^\n]*/g,'')).flatMap(c=>{const x=c.match(/^(\w+)\s+([\w.]+(?:\(\d+(?:,\d+)?\))?(?:\[\])?)([\s\S]*)$/);if(!x||/^(primary|foreign|unique|check|constraint)$/i.test(x[1]))return [];if(removed.has(name)&&x[1]==='currency')return [];const nullable=!/not null|primary key/.test(x[3]),optional=nullable||/default |generated /.test(x[3])||x[1]==='currency';return [{name:x[1],type:type(x[2])+(nullable?' | null':''),optional}];});
 const row=cols.map(c=>`          ${c.name}: ${c.type}`).join('\n');
 const ins=cols.map(c=>`          ${c.name}${c.optional?'?':''}: ${c.type}`).join('\n');
 const upd=cols.map(c=>`          ${c.name}?: ${c.type}`).join('\n');
 additions+=`      ${name}: {\n        Row: {\n${row}\n        }\n        Insert: {\n${ins}\n        }\n        Update: {\n${upd}\n        }\n        Relationships: []\n      }\n`;
}
db=db.replace('    Tables: {','    Tables: {\n'+additions);
// Publish new RPC contracts, including the formerly untyped financial boundary.
const migration=fs.readFileSync(`${dir}/20261026000100_syp_only_architecture.sql`,'utf8');
const names=new Set(['record_subscription_payment','set_merchant_credit_limit','record_driver_cash_remittance','pay_driver_cash_credit','create_merchant_settlement_batch','record_merchant_settlement_payment','admin_financial_report','admin_sales_revenue_report','merchant_financial_account']);
let rpcs='';for(const m of migration.matchAll(/create or replace function public\.(\w+)\s*\(([\s\S]*?)\)\s*returns\s+(\w+)/gi)){
 if(!names.has(m[1])||db.includes(`      ${m[1]}: {`))continue;
 const args=split(m[2]).filter(Boolean).map(a=>{const x=a.match(/^(\w+)\s+([\w.]+(?:\[\])?)([\s\S]*)$/);if(!x)throw new Error(a);return `          ${x[1]}${/default/i.test(x[3])?'?':''}: ${type(x[2])}${/default null/i.test(x[3])?' | null':''}`}).join('\n');
 rpcs+=`      ${m[1]}: {\n        Args: {\n${args}\n        }\n        Returns: ${m[3]==='void'?'undefined':type(m[3])}\n      }\n`;
}db=db.replace('    Functions: {','    Functions: {\n'+rpcs);
const projections={
 merchant_financial_positions:'merchant_id currency invoices_total payments_allocated invoice_outstanding payments_recorded unapplied_payment_balance commissions_due booked_exposure effective_exposure credit_enabled credit_limit credit_used credit_available',
 driver_cash_custody_positions:'driver_id currency cash_collected_amount delivery_fee_entitled_amount net_custody_due_amount office_received_amount custody_remaining_amount driver_credit_amount driver_credit_paid_amount',
 merchant_order_entitlement_positions:'merchant_order_entitlement_id store_order_id merchant_id commission_id currency gross_items_amount commission_amount_at_delivery initial_net_entitlement_amount adjustment_amount current_entitlement_amount status delivered_at created_at',
 merchant_settlement_batch_positions:'batch_id merchant_id currency status created_at batch_entitlement_id merchant_order_entitlement_id store_order_id delivered_at current_entitlement_amount paid_amount remaining_amount',
 admin_cash_movement_events:'id occurred_at currency amount event_type direction party_id reference? note',
 admin_delivery_fee_report_rows:'customer_order_id delivery_task_id driver_id currency delivery_fee_amount delivery_zone_id? delivery_zone_name_snapshot delivered_at',
 admin_merchant_settlement_report_batches:'id merchant_id currency status created_at entitlement_amount paid_amount',
 admin_merchant_financial_report_events:'id merchant_id currency occurred_at event_type amount store_order_id? batch_id? status? reference? paid_amount? remaining_amount?',
 admin_platform_revenue_report_events:'id merchant_id currency occurred_at event_type amount store_order_id? commission_id? invoice_id? payment_id? reference?',
};
projections.admin_merchant_payout_report_rows=projections.merchant_settlement_batch_positions;
let viewTypes='';
for(const[name,fields]of Object.entries(projections))if(!db.includes(`      ${name}: {`)){
 const columns=fields.split(' ').map(field=>{const nullable=field.endsWith('?'),key=field.replace('?','');const t=key==='currency'?'"SYP"':key==='credit_enabled'?'boolean':/amount|total|allocated|outstanding|recorded|balance|due|exposure|credit_(limit|used|available)/.test(key)?'number':'string';return `          ${key}: ${t}${nullable?' | null':''}`}).join('\n');
 viewTypes+=`      ${name}: {\n        Row: {\n${columns}\n        }\n        Relationships: []\n      }\n`;
}
db=db.replace('    Views: {','    Views: {\n'+viewTypes);
fs.writeFileSync(dbFile,db);
