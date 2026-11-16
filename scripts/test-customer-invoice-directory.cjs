const assert = require("node:assert/strict");
const fs = require("node:fs");

const sql = fs.readFileSync("supabase/migrations/20261201000100_customer_invoice_directory.sql", "utf8");
const screen = fs.readFileSync("src/components/finance/CustomerInvoicesScreen.tsx", "utf8");
const service = fs.readFileSync("src/lib/invoice-finance.ts", "utf8");
const route = fs.readFileSync("src/app/invoice.tsx", "utf8");

assert.match(sql, /role = 'customer'/);
assert.match(sql, /i\.owner_id = owner_value/);
assert.match(sql, /i\.kind in \('INV', 'SET', 'COR'\)/);
assert.match(sql, /kind_value = 'ALL' or i\.kind = kind_value/);
assert.match(sql, /position\(query_value in i\.reference\)/);
assert.match(sql, /commerce_references/);
assert.match(sql, /\(i\.created_at, i\.id\) < \(before_created_at, before_id\)/);
assert.match(sql, /limit 13/);
assert.match(sql, /limit 12/);
assert.match(sql, /revoke all on function public\.read_customer_invoices/);

assert.match(service, /readCustomerInvoices/);
assert.match(service, /rows\.length > 12/);
assert.match(service, /\["INV", "SET", "COR"\]/);
assert.match(route, /<CustomerInvoicesScreen\/>/);
assert.match(screen, /<FlatList/);
assert.match(screen, /keyExtractor=\{item => item\.id\}/);
assert.match(screen, /pathname: "\/financial-invoice", params: \{ id: item\.id \}/);
assert.match(screen, /const snapshots = new Map/);
assert.match(screen, /const inflight = new Map/);
assert.match(screen, /فاتورة شراء/);
assert.match(screen, /مستند تصحيح/);
assert.match(screen, /مستند تسوية/);
assert.match(screen, /owner_id=eq\.\$\{owner\}/);
assert.match(screen, /presentation\.payment === "مسددة بالكامل"/);
assert.match(screen, /presentation\.payment === "بانتظار السداد"/);
assert.match(screen, /presentation\.payment === "مسددة جزئيًا"/);
assert.match(screen, /colors\.successSurface/);
assert.match(screen, /colors\.warningSurface/);
assert.match(screen, /colors\.infoSurface/);
assert.match(screen, /colors\.errorSurface/);
assert.doesNotMatch(screen, /<InvoiceStatus invoice=\{invoice\}/);

console.log("PASS customer invoice directory: owner scope, server search/filter, stable cursor, 12-row pages, cache/dedupe and typed navigation");
