# C4 — immutable order mode, pickups and atomic cash

Local draft 2026-11-07. NO remote connection or migration application. Applied C2/C3 files unchanged. This is NOT deployment approval.

## Unapplied migrations, in order

1. `20261107000100_finance_c4_decimal_contract.sql`: exact major SYP, up to two decimals. Locks and validates a potentially nonempty ledger before replacing only its integral CHECK. Preserves unscaled numeric (no implicit rounding), amounts, balance/reversal functions, ACLs and 20-major-digit bound. Invalid existing journals block migration; no history is rewritten.
2. `20261107000200_c4_store_pickups_review_gate.sql`: admission defaults OFF. A same-transaction birth marker plus C3 pricing snapshot chooses immutable `legacy`/`c4`. Missing mode means legacy. Only new positive-approved orders can enter C4. Later snapshot insertion cannot convert history. Shared configuration lock serializes admission with flag changes. Refuses admission before migration 3 exists.
3. `20261107000300_c4_atomic_delivery_collection.sql`: legacy-writer fences, immutable delivery result (cash or zero-cash), completion/recovery RPCs and balanced positive-amount C2 journals.

Owner applies nothing until independent review and isolated testing. Disabling new admission never changes already chosen modes or stops existing C4 tasks. No automatic conversion, backfill, global trigger disable or runtime mode editing.

## Pickup gate

`confirm_c4_store_pickup(task,child,expected_user)` checks JWT subject, approved assignment, immutable mode, review state, actual ready child membership and ORD/SUB/DLV links. Locks parent then task, then changes the child. Each task/child has one immutable receipt. Last required receipt advances the EXISTING task, never creates DLV. Reassignment after the first receipt is prohibited. No new reassignment API is introduced.

`get_c4_pickup_context` returns mode, confirmed children, pricing version, `can_confirm_pickup`, `can_complete_delivery` and reason, only for assigned tasks. UI obeys these capabilities. Internal PostgreSQL 42883 fails closed. Only PostgREST PGRST202 takes the pre-C4 compatibility branch; stale schema-cache detection cannot bypass the server's immutable-mode guard.

## Legacy writer map and isolation

- Deferred totals/commission snapshot (`20261018000500`, final SYP definition `20261026000100`): retain authoritative pending commission snapshot; skip C4 accrual even when delivered in the same transaction.
- Immediate child commission status trigger: legacy delivered makes commission due and writes exposure ledger; rejection/cancellation voids pending snapshots. C4 accrual wrapper returns; a BEFORE INSERT/UPDATE due guard prevents alternative accrual. Pending/void metadata remains.
- Immediate child-delivery and deferred task-delivery cash triggers (`20261018000800`): legacy foundation creates customer cash obligation, driver fee entitlement, merchant net entitlement. C4 foundation wrapper returns.
- Admin commission reversal: legacy reversal, exposure ledger and downstream merchant entitlement adjustment remain; C4 reversal via legacy RPC is rejected.
- Defense in depth: BEFORE INSERT guards on old cash obligations, driver fee and merchant entitlements, reversals, adjustments and commission-related merchant ledger sources stop alternate/cached legacy helper paths from writing C4 economics.

Original accrual/foundation/reversal helpers move to inaccessible finance_private names; public wrappers preserve signatures and legacy behavior. No legacy global disable. Any unexpected old writer for C4 fails the whole transaction rather than double books. Task pickup has an additional receipt guard; deferred task/child delivery guards require the matching immutable atomic result, including for alternative status writers. The atomic RPC explicitly defers its own result guards before transitioning and flushes them before returning. All private runtime-role execution remains revoked; SECURITY DEFINER paths are empty.

## Atomic contract

`complete_delivery_and_collect_cash(target_task uuid, expected_user uuid, attempt_key uuid, expected_pricing_version bigint) -> jsonb`

No caller-provided money. Checks assigned approved JWT driver, parent/task locks, immutable C4 mode, every active child receipt and handed-to-driver state, current C3 pricing version and no review. Uses current total only, never original/proposed money. Verifies authoritative store totals against commission snapshots and C3 current items/fee. Does not alter snapshots or prices.

For positive totals, existing C2 account definitions, with merchandise G, commissions C, fee F, total T=G+F:

1. Financial event `full_cash_collected`: Dr driver_cash T / Cr customer_advance T. Full physical custody, no wage deduction.
2. Financial event `delivery_completed`: Dr customer_advance T / Cr merchant_sales_payable sum(G-C), Cr commission_revenue C, Cr delivery_revenue F. Zero credit lines omitted. Credits total T; advance clears. Merchant accounts visited in stable order.

No new account definitions or suspense balances. Delivery fee is NOT silently treated as driver wage. Wage accrual/expense, office collection and payouts remain C5/C6/C7 work. Owner must approve these recognition entries against the agreed C2 policy before admission. Legacy balance screens remain legacy; they do not include new C4 journal amounts. No combined financial read model or future payout capability is implied.

Task delivery, financial events/journals, separate lifecycle events, immutable result and completed operation are ONE transaction. SET CONSTRAINTS ALL IMMEDIATE flushes deferred triggers before success. Any technical/deferred failure rolls everything back; PostgreSQL sequence gaps remain possible.

Task/order receipt uniqueness, fixed source/event uniqueness and one journal/event prevent duplication beyond the attempt key. Same key plus changed canonical input raises before replay. Same-key retry recovers. Different unused key for completed task returns original receipt without a second operation/collection. Rejected keys remain rejected; a deliberate corrected attempt requires a new key.

`recover_delivery_collection(attempt_key, expected_user)` checks JWT ownership, returns completed/rejected/unknown and never writes. Recovery may read owned history after approval changes; new completion still requires current approval.

## Client

Handwritten adapters for unapplied SQL are explicitly documented in store-pickups.ts and delivery-collection-attempt.ts, NOT official generated database types. Durable owner/task/key/version is saved before sending. Synchronous lock, identity checks around I/O, read-first recovery, no automatic resend on unknown. Explicit retry uses frozen old key/version. Cache read/write failures block writes; cache removal failure can only cause read/replay, not second server economics.

Driver UI provides per-store pickup, current server amount, cash/delivery action for positive money and an explicit no-cash delivery action for zero, recovery action, server capability gating and realtime refresh. Previous-owner task rows are hidden after account switch. No approved Layout/Header/BottomNav changed.

## Approved zero-cash delivery (owner decision implemented locally)

An admitted C4 order may become zero after a genuine store rejection while an active store remains. The SAME RPC retains assignment, pickup, review, version, frozen-key and economic uniqueness guards. Initial zero-approved orders still follow the unchanged legacy eligibility rule; this change handles admitted orders whose current total becomes zero.

When current total is zero, every active merchandise total, commission base/amount and delivery fee must also be zero. A positive economic component returns durable rejected `zero_cash_economic_conflict`, leaving task/finances untouched. Missing/invalid authoritative snapshots fail closed. No merchant payable, commission revenue or delivery revenue is discarded: valid zero economics imply all are zero.

A valid zero delivery writes the independent `delivery_completed` lifecycle event, immutable result with `kind=zero_cash_delivery`, amount 0, lifecycle-event FK, and completed idempotency operation. It creates NO financial accounts, financial events, journals, custody or cash-collected lifecycle event. C2 allows an operation with no financial events; every financial event still requires a posted journal, so a fake zero-valued financial event is NOT created. Original C2 constraints are untouched.

The result table accepts exactly two shapes: positive cash delivery with both financial event IDs, or zero delivery with both IDs NULL. Its timestamp is completed_at, not a claim of zero cash collection. Recovery and retries return the same explicit kind; task/order uniqueness spans both paths. The amount is never accepted from the UI. The UI labels zero delivery separately and never reports successful cash collection for it.

Positive delivery retains its two existing balanced journals and full custody. Zero does not run that branch. Deferred task/child guards require the matching immutable result and correct delivery lifecycle relationship for BOTH paths; any failure rolls back result, status and events together.

All three draft migrations are READY FOR ISOLATED TEST / owner review with admission OFF. The former zero-policy blocker is resolved. This is not approval to enable C4 remotely: actual PostgreSQL/JWT/concurrency and phone tests remain unexecuted.

## Isolated PostgreSQL tests — NOT RUN here

No psql/postgres/pg_ctl found on PATH; no services installed/created, no database SQL executed. Source checks are not PostgreSQL/JWT proof.

Owner prepares disposable numeric-loopback PostgreSQL, FULL prior Supabase schema/Auth/Storage/roles/migrations plus three C4 drafts, synthetic approved fixtures only, no outbound hooks. Never run on primary/linked Supabase or a renamed real database.

Use pinned C2 manifest (database OID, cluster system identifier, marker/token, absolute psql path and all C2 fixture mappings). Add c3Products: three available products in distinct accepted stores with valid active commission snapshots; add c4OtherDriver: second approved driver UUID. C2 preflight requires clean synthetic baseline, not a production-empty-ledger assumption. Separately test decimal migration on a NONEMPTY valid ledger.

Owner-only invocation AFTER environment preparation:

```powershell
$env:C2_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C4_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C2_TEST_MANIFEST = 'C:\isolated-tests\manifest.json'
# Set C2_TEST_DATABASE_URL privately to pinned numeric loopback *_c2_test DB.
node scripts/test-finance-c4-postgres.cjs
```

Harness rejects remote hosts/databases, verifies server OID/system/token before SQL in EVERY connection, applies no migrations and performs no cleanup. It creates and commits synthetic rows, retained in the disposable DB.

Positive rollback suite: exact decimals/reversal, actual existing foreign child, assignment, flag independence, review, receipts, old RPC bypass, reassignment denial, injected journal failure and explicitly deferred result-trigger failure, complete rollback, full custody, absence of legacy entitlements, canonical mismatch and replay. Flushes constraints before assertions. Role/claim RLS simulation is NOT a signed JWT network test. Sequence advances cannot roll back.

The additional finance_c4_zero_delivery.sql rollback suite creates a genuine positive C3 order with a 100% discount offer and zero-fee zone, rejects the paid store, and verifies zero delivery, unchanged original snapshot, lifecycle audit, no accounts/events/journals, same/different-key replay and recovery. A separate deliberately contradictory synthetic current-price row proves that hidden positive economics is rejected without delivery. It is invoked only by the same pinned isolated harness. This SQL has NOT been executed here.

Harness: creation COMMIT before merchant changes, no early/duplicate DLV, rejected store recalculation, legacy completion after admission flips, overlapping pickup/collection sessions PROVEN by pg_blocking_pids before COMMIT, one receipt/two posted journals and recovery after committed/lost response.

Still required: actual isolated suite/harness execution; signed JWTs for all roles; competing drivers/duplicate-child races; admission toggle/creation race; nonempty-ledger migration test; outbound-hook audit; device/network-loss tests. Missing tests are NOT PASS.

## Local validation

Run TypeScript, Expo lint, git diff --check; test-finance-c4.cjs, test-delivery-collection-attempt.cjs, C3, driver collection, C2/source guard and merchant finance regressions. node --check validates harness JavaScript syntax only. Keep admission OFF.
