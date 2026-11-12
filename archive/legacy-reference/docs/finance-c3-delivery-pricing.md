# Finance Rebuild C3 / C3-FIX — owner deployment only

Status: local implementation corrected after independent QA; **READY FOR QA
RECHECK**, not a claim of PostgreSQL, JWT, concurrency or device acceptance.
No remote connection, SQL execution, migration application or package installation
was performed. C3 remains unapplied. Applied C2/history is not edited.

## Approved policy

**Defensive Increase Guard Only.** There is no increase approval, admin repricing,
override or unblock operation. A rejection recomputes remaining merchandise from
server child totals and delivery from the ORIGINAL zone snapshot. Decrease/equality
applies and notifies. An unexpected increase above the original/current payable
amount remains unapplied, is audited, and blocks dispatch/accept/delivery. Review
is sticky. The admin sees original/current/proposed/difference/reason/timestamps
read-only. No remaining child is automatically cancelled by this guard.
All legally excluded children means parent cancellation, zero payable total and
no DLV. Resolving a genuine exceptional order requires a separately approved
policy, not an undocumented SQL workaround in C3.

## Existing source and retained legacy behavior

Before C3, `delivery_zones.fixed_fee` was the fee source and
`create_order_from_cart` created `pending_stores` immediately. The existing
`delivery_dispatch_after_store_ready` trigger invoked
`make_order_delivery_available` to release it. C3 replaces that function in
place, without installing a second dispatch trigger.

Parents without a C3 pricing snapshot keep the final legacy release/status
branch and existing task identity. No history backfill, references renumbering,
product/offer redesign or old financial writer replacement occurs.
The final merchant/cancel/driver RPCs are moved with their original OIDs/bodies
to inaccessible `finance_private.c3_legacy_*` functions. Same-name public wrappers
lock the parent before child/task locks and preserve authorization/transitions.
The original five-argument creation function is an internal builder by ACL only.

Legacy commissions still use their subscription snapshot and the original
TWO-DECIMAL merchandise basis. Legacy cash foundations still read delivered
child totals plus the effective parent `delivery_fee` once. Rejected/cancelled
parts create no delivery cash/merchant entitlement. Existing unique source keys,
commission reversals, driver custody formula and settlement rules remain intact.
No C2 financial operation/event/journal writer is called by C3.

## Precision, rounding and limits — FIX 1

Products, quantity multiplication, discounts, bundle price and component allocation
retain PostgreSQL `numeric` and `round(...,2)` rules (positive halves upward).
C3-FINAL-FIX corrects three remaining whole-unit calls in the order builder.
Bundle components use differences between rounded cumulative proportional shares,
in the existing `item_role, id` order; the last receives the exact remaining amount.
Independent rounded shares could accumulate above the bundle price and make the
last component negative, even with two decimals. Monotone cumulative boundaries
avoid that defect without changing the bundle total or store commission basis.
The builder also checks nonnegative components and complete allocation. A zero
component allocation is valid; an invalid zero allocation basis or negative amount
fails, rather than inventing a price. Two 0.40 products bundled at 0.50 remain
purchasable with 0.25/0.25 allocations; 100.50 at 10% becomes 90.45.
Four 1.00 components bundled at 2.00 each receive 0.50. Residual cents can be
assigned to an intermediate component, not necessarily the last: three equal
weights at 0.10 receive 0.03/0.04/0.03. Unit snapshots remain rounded to two
decimals; authoritative line totals, not unit-price multiplication, drive totals.
No whole-SYP merchandise conversion exists.

Only delivery base/uplift/fee are nonnegative INTEGER SYP. Fee is
`base + max(0, distinct active stores - 1) * uplift`; zero stores gives zero fee.
The monetary ceiling retains numeric(14,2): 999999999999.99 SYP. Delivery integers
are bounded by 999999999999. Negative, nonfinite, excess-scale or overflowing
amounts fail safely. Client decoders do not round; comparisons/sums use integer
minor units within JavaScript's safe integer range. Exception projections use
exact decimal strings, including amounts too large for the normal order range.

The migration preflight refuses existing fractional base fees. The owner must
review such settings explicitly; no existing configuration is rounded silently.
C2's whole-unit journal contract is NOT changed or activated by this phase.

## Zones, addresses and snapshots

Existing zone IDs/name uniqueness/active state/order/address FKs remain. New
`additional_store_fee` defaults to 0 and `pricing_version` increments server-side.
Only admin can save pricing; optimistic version matching rejects stale edits.
The admin control lives inside `/admin/more`, with no Layout/Header/Nav changes.

Checkout explicitly selects an active zone or the active zone of its saved
default address. It never selects an arbitrary first zone. Address text remains
free-form under the authenticated checkout intent; no external address ID is
accepted or trusted. Saved addresses retain their existing owner RLS. This is
not geofencing/GPS coverage validation. No valid zone means no order.

- `order_pricing_snapshots`: immutable original approval/zone/base/uplift/version,
  store count, merchandise, delivery and server decision time.
- `order_pricing_current`: effective payable amounts/version/review flag.
- `order_pricing_revisions`: append-only before/proposed/applied/reason/actor/time.
- `customer_order_requests`: private owner/key/canonical input and terminal result.

Original items, snapshots and `customer_order_totals` are preserved. The parent
operational `delivery_fee` tracks the effective fee so legacy delivery collection
uses the decrease. Customer/admin DTOs display current amounts with the original
approval labelled separately. Today's admin zone edits never reprice old orders.

## Expected-user and frozen cart intent — FIX 2

Both creation and recovery check `expected_user = auth.uid()` and customer role
BEFORE writes or replay. A changed bearer cannot execute another account's
captured intent. Replay/recovery also check that the stored order belongs to the
expected customer. Client pre/post checks supplement, not replace, this guard.

The quote returns a canonical `cart_signature`, generated from server product
IDs/quantities/prices/units/availability, selected offer version/components and
store notes. It is canonical JSON text, not a client-calculated authority or an
extension-dependent hash. Creation locks the zone before cart, then cart rows,
offers/components and products in stable order. It recomputes the signature and
price, refusing changed content/price. Runtime roles cannot execute those private
helpers. Catalog definitions themselves are not modified.

Current provisional RPC signatures (types must be generated after owner apply):

- `quote_c3_cart(target_zone uuid, expected_user uuid) -> jsonb`
- `create_c3_order_from_cart(input_recipient_name text, input_contact_phone text,
  input_delivery_address text, input_delivery_zone uuid, input_customer_note text,
  request_key_value uuid, expected_total numeric, expected_user uuid,
  expected_cart_signature text) -> jsonb`
- `recover_c3_order_request(request_key_value uuid, expected_user uuid) -> jsonb`

Creation returns completed/order_id/replayed or a terminal rejected/code result.
Its inner subtransaction rolls back order/items/references/notifications on a
handled business rejection, but retains a rejected request receipt. A delayed
same-key request therefore cannot create a previously rejected intent. Unexpected
SQL failures and commit-time failures still roll back the transaction and remain
unconfirmed at the client; they are never presented as successful or safely absent.
Sequence gaps after rollback are normal and not repaired.

## Separate recovery and new creation — FIX 3

Client results are explicit `created`, `recovered`, `pending`, `rejected`, `none`.
Recovery runs independently of cart existence, quote validity or delivery fields.
A previous pending cache is always inspected first, never matched by equal
amount/address. A completed receipt produces `recovered`, not a success message
for the current cart. The UI shows the previous order link and preserves the new
cart; a later explicit confirmation starts a fresh key, even for identical items,
amount and address.

Unknown status is NOT evidence of failure. Only an explicit retry sends the
frozen OLD arguments/key/signature. Changed cart contents then fail safely.
A replayed success is still recovered. Neither recovered nor created results
blindly call `clearAfterOrder`; the app re-reads the server cart, so a new cart is
preserved. A refresh failure does not make a confirmed order resendable.

Durable `c3-checkout-v2:<owner>` attempts are owner-scoped and frozen. Every send,
including explicit retry, requires successful persistent storage. Storage read
failure is unknown, never treated as no pending attempt. Cleanup failure can
only cause another recovery. v1 provisional caches are not reinterpreted: the
v1 C3 migration was never applied. No existing server checkout history is purged.
Raw request inputs have no runtime table-read grant; recovery returns result only.

## DLV, C2 references, lifecycle and permissions

C3 creates no task until every active child is ready, count is nonzero, parent is
eligible and pricing is not blocked. Parent-first locks serialize legal mutations;
the existing UNIQUE parent-task key remains the final at-most-one barrier.
C2 registers ORD/SUB after actual row creation and DLV after actual task insertion.
Lifecycle events use stable natural keys, real parent/child/task IDs and C2's
server-owned actor/time/order sequence. No phantom DLV or number allocator exists.

New tables have RLS and no client DML. Customer/admin/assigned-driver pricing
reads follow existing parent-total visibility. Merchant context returns its own
SUB references and no parent pricing/other stores' SUB references. Available
unassigned drivers get identifiers only. All definers use empty search_path and
qualified relations with explicit ACLs. Finance-private schema/functions stay
inaccessible to anon/authenticated/service_role. No legacy RLS policy is expanded.

## Deployment compatibility — FIX 6

**BREAKING APPLICATION CONTRACT:** after migration, old app versions calling
`create_order_from_cart(text,text,text,uuid,text)` cannot create orders. The
provisional old C3 seven-argument RPC/recovery overloads are not supported either.
The owner must coordinate the matching app release or a declared maintenance
window. Do not restore the unchecked old creation grant as a shortcut.

Order for the OWNER only:
1. Existing migration history through applied C2 `20261105000100` remains intact.
2. Review corrected `20261106000100_finance_c3_delivery_pricing.sql`; it is the ONE
   unapplied migration to apply transactionally. The agent does not apply it.
3. Execute `supabase/verification/finance_c3_readiness.sql` READ ONLY. Inspect ACLs,
   triggers, ownership, expected overloads and zero-row invariants.
4. Generate official database types from the applied schema, review the diff,
   and deploy the matching application under the coordinated release plan.
5. Perform synthetic API/JWT/phone tests before accepting the release.

## Real PostgreSQL tests — FIX 4 / NOT RUN locally

No psql/postgres/pg_ctl executable is available locally; nothing was installed.
Actual SQL, real JWT, lock concurrency and device tests remain NOT RUN.
C2 behavioral verification remains deferred and is not closed by local source tests.

Use a disposable LOCAL PostgreSQL with the complete previous Supabase schema,
auth/storage roles/extensions, all previous migrations, C2 and C3. A bare database
with only C2/C3 is invalid. Do not use real customer data or the linked project.
The runner never applies migrations, creates a service or cleans up a database.

The existing C2 guard is unchanged: numeric loopback only, database name ending
`_c2_test`, pinned database OID/system identifier/absolute psql path, test marker
and synthetic fixture mapping. Prepare that environment using C2's instructions.
Add `c3Products` with three available products from distinct accepted stores and
valid active subscription commission snapshots. The first store needs capacity
for four synthetic companion products (one fractional and three final-pricing
fixtures), plus the synthetic offers used by the suite. The legacy `order`/`task`
fixtures must have no C3 snapshot, an existing `pending_stores` task and children
before readiness. The driver must be accepted and available. Missing fixtures
FAIL; they are not skipped or converted into success.

Owner opt-in commands after establishing the pinned isolated identity:

```powershell
$env:C2_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C3_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C2_TEST_MANIFEST = 'C:\absolute\trusted-local-test-manifest.json'
# Privately set C2_TEST_DATABASE_URL to that numeric-loopback test database.
node scripts/test-finance-c3-postgres.cjs
```

The SQL transaction suite flushes deferred triggers at creation/delivery boundaries
BEFORE assertions. It checks fractional bundles/quantities/zero component amounts,
100.50 pricing, commission bases, original snapshots, cash/driver/merchant
entitlements, terminal rejection/recovery, expected-user mismatches, role/RLS
simulation, old tasks, all-rejected cancellation and injected increase blocking.
Rows rollback; sequences retain gaps. These claim settings are NOT real signed JWTs.

The concurrency suite uses persistent psql sessions that ACK identity BEFORE any
test SQL. An independent observer MUST prove session B waits on session A using
`pg_stat_activity`/`pg_blocking_pids`; no sleep-based success is accepted. It covers
same-key creation, readiness and retries, readiness/rejection, and both orderings
of cancellation/acceptance. Creation and driver transitions COMMIT in separate
transactions; assertions run after deferred triggers and verify legacy financial
uniqueness plus no C2 journal rows. Committed synthetic rows remain in the
isolated database; no cleanup is executed. No external side-effect hooks may be
installed in that disposable environment.

The runner deliberately refuses Supabase remote endpoints. If the owner chooses
a separate Supabase test environment, approve a distinct fixture/test procedure;
do not disable the existing guard. Never paste the mutating test file into the
primary Dashboard. Read-only readiness SQL is not a historical/concurrency/JWT
proof and does not substitute for these tests.

## Local verification and files

New C3-FIX helper: `scripts/finance-c3-test-session.cjs` (test tooling only).
Corrected: C3 migration, `src/lib/c3-order-contract.ts`, `src/lib/c3-orders.ts`,
`src/lib/customer-orders.ts`, `src/lib/local-cache.ts`, `src/app/checkout.tsx`,
`src/components/admin/C3DeliverySettings.tsx`, both C3 test files,
`supabase/verification/finance_c3_readiness.sql` and this document.
Checkout is also keyed by account so a failed address reload cannot carry a
previous account's draft into the next account.
No applied migration, approved Layout, Auth policy, financial writer or
product/offer editor was changed.

Run local C3/C2/guard/order/home/finance/report/offer regressions, JavaScript syntax
checks, `npx.cmd tsc --noEmit`, `npx.cmd expo lint`, and `git diff --check`.
Passing source/client mocks are not PostgreSQL, real JWT or phone acceptance.

## Recorded C3-FIX verification

PASS before C3-FINAL-FIX: 35 local C3 contract/client/process-boundary checks. The
independent recheck found those checks did NOT detect three residual rounding
defects; that earlier result is not pricing acceptance. C3-FINAL-FIX adds exact
BigInt evaluation of arithmetic expressions extracted from the migration, compares
discounts with quote expressions, tests individual allocations and 200 residual
cases, and requires in-memory rounding/allocation mutations to fail. This limited
evaluator is NOT a PostgreSQL engine. The SQL suite adds exact component and
commission assertions through real quote/create RPCs, still NOT RUN locally.
Other previously recorded checks: C2 source and
guard checks; merchant orders/home; safe product removal; merchant finance and
settlement/report contracts; offer editor; SYP architecture; bounded historical
schema/view contracts. These are offline checks with mocks/source inspection.
PASS: TypeScript, Expo lint (0 errors, the same 6 existing warnings), JavaScript
syntax checks and diff whitespace checks.
NOT RUN: actual migration execution, PostgreSQL behavioral/concurrency tests,
real signed JWT tests and device tests. PostgreSQL executables were not found.
C2 behavioral tests remain deferred, not successful.

No known P0/P1 remains from this fix's local review. Remaining verification and
integration dependencies: real SQL/JWT/concurrency/device acceptance, official
type generation after owner apply, and a separately approved minor-unit policy
before future C4 writes decimal merchandise into C2's whole-unit journal. C3
continues to use legacy finance only and does not change C2 to resolve that future
decision. Verdict remains READY FOR QA RECHECK, not production acceptance.

## C3-FINAL-FIX verification scope

38 offline C3 checks now pass, including extracted-expression arithmetic and
in-memory mutation detection. Added PostgreSQL assertions check each saved line,
quote/approved total equality, whole delivery fees, and the commission base after
deferred triggers. These PostgreSQL assertions have NOT been executed locally.
The only production change in this focused fix is in the unapplied C3 builder;
no UI, legacy financial writer, applied C2 migration or increase-guard policy is
changed. C2 monetary-scale decisions remain required before C4, not implemented.

## Driver collection closure follow-up — 2026-11-07

The owner reports C3 has been applied to `dfpaeiffqkmedftjiqbm`; this follow-up
does NOT connect to that potentially live project or verify its actual catalog.
Earlier predeployment status statements above are historical.

Assigned tasks now read `get_c3_order_context(target_orders)` and use ONLY
`pricing.current.total`, decoded through the existing provisional C3 decoder.
The RPC wraps each parent ID as `{references, pricing: {original, current}}`;
it returns `pricing: null` for legacy orders and omits entirely inaccessible
orders. Its `c3_pricing_readable` predicate grants driver pricing only when a
delivery task has `driver_id=auth.uid()`, not merely when the driver is available.
Unassigned-task cards still contain no customer collection amount.

The assigned-task query is scoped by driver ID; the service verifies the current
Auth subject before and after reads, checks returned driver IDs, and fences UI
reads by account/request generation. Failed context reads do not fall back to
old totals. A review flag displays a stopped-task message without any proposed
amount. Unknown amounts show retry and block pickup/delivery controls. The
service also refreshes the owned task's amount/review state before invoking the
unchanged status RPC. Existing server-side assignment and review checks remain.
No new financial operation or DLV creation was introduced.

### Legacy limitation — still a closure blocker

For orders without C3 pricing, only an owned, matching task/order row from
`customer_order_cash_obligations.collectible_amount` supplies money. This is the
existing server financial snapshot; it is read unchanged under RLS. The final
SYP cash-foundation function explicitly says historical `customer_order_totals`
may include rejected children and must NOT be used to derive cash obligations.
No local addition of products/fees or substitution of original totals is used.

That obligation is normally created only AFTER delivery. Therefore an active
legacy order lacking it remains unavailable and the app refuses progression.
Resolving that case requires an owner-approved, authorized server READ projection
of the legacy collectible amount before delivery. No migration/RPC was created
or modified here. Do not work around this by changing totals or forcing delivery.

The UI/service guard cannot make "driver has successfully read the amount" a
database invariant. Direct RPC callers can bypass the UI; existing status RPCs
still authorize the assignment and block `review_required`, but they do not
require an acknowledged amount/version. Enforcing such an acknowledgement would
require an independently approved server contract/change, not implemented here.

### Official types — NOT COMPLETE

`src/types/database.ts` is not regenerated for C3. No usable local applied
PostgreSQL schema/psql was found; migrations alone are not official generated
types. The temporary handwritten adapter and runtime decoder remain explicitly
labelled. No remote generation was attempted without owner permission.

Owner-only optional generation (read-only remote connection; owner approval is
required), first to a separate UTF-8 temporary file:

```powershell
$c3Generated = & npx.cmd supabase gen types typescript --project-id dfpaeiffqkmedftjiqbm --schema public
if ($LASTEXITCODE -ne 0) { throw 'Type generation failed; keep existing database.ts' }
$c3TypesFile = Join-Path $env:TEMP 'tasawuq-c3-database.generated.ts'
$c3Generated | Set-Content -LiteralPath $c3TypesFile -Encoding utf8
git diff --no-index -- src/types/database.ts $c3TypesFile
# Exit 1 from this diff means files differ. Review before replacing anything.
```

Review all C3 tables, one-to-one relations, RPC argument names/JSON return types
and renamed private functions; then integrate deliberately, replace the temporary
RPC cast where applicable, and rerun TypeScript/lint/C3 and driver tests. Generating
types is not authorization to apply a migration.

Offline tests: `node scripts/test-driver-collection.cjs` exercises actual service
and decoder paths with mocked transport, including fractional current money,
review/failure, legacy obligations/missing snapshots, identity changes and query
scoping. `node scripts/test-finance-c3.cjs` retains 38 existing checks, including
dispatch/no-duplicate gates. Neither is a real PostgreSQL/JWT/concurrency/device
test. The new card/disabled/retry bindings are source checks, not rendered UI QA.

Recorded closure follow-up checks: 14 driver collection + 38 C3 offline checks
PASS; TypeScript PASS; Expo lint PASS with the same six pre-existing warnings;
git diff/added-file whitespace checks PASS. Actual SQL, signed JWT/RLS, real
concurrency and phone tests NOT RUN. Overall closure remains BLOCKED by active
legacy pre-delivery projection and pending official generated types; C3-backed
assigned-task display can proceed to owner-approved manual QA.
