# C5 — driver custody and confirmed office cash handover

Local implementation for owner review, 2026-11-07. No Supabase connection, migration application, Metro/Web, C6 or C7. C4 and C5 admission remain OFF by default. PostgreSQL/JWT/concurrency behavior has NOT been executed here.

## Dependencies and new migration

Apply nothing automatically. The local order for an isolated test database is the complete prior schema, applied C2/C3 definitions, the THREE local C4 drafts, then:

`supabase/migrations/20261108000100_finance_c5_driver_cash_handover.sql`

A fail-closed dependency preflight requires the C4 decimal CHECK, account/rejection helpers and current zero-cash result fields. No applied migration file is modified. C5 extends the two C2 document-link CHECKs with a dedicated RCT FK/branch and retains ORD/SUB/DLV/MSB/SIN/TXN exactly. It refuses an unexpected number of previous checks. Existing C2 reference numbering/immutability and sequence permissions are preserved. RCT is allocated only for a confirmed handover, not a request or discrepancy. Aborted transactions may leave sequence gaps.

## Existing code retained and isolated

- Legacy sources: driver_cash_custody_positions, customer_order_cash_obligations, driver_delivery_fee_entitlements, driver_cash_remittances, driver_cash_credit_payouts and their existing RPCs. Their wage subtraction/credit rules remain unchanged and are explicitly labeled legacy in both UIs.
- New C4 source: delivery_collection_results + successful C2 financial events, posted journals and driver_cash account. Zero-cash delivery has no financial event/account/line and cannot create C5 custody.
- Reused FinancialAmount, AppButton/TextField/Modal refined, theme/Cairo, existing driver/admin routes, createFinancialReader and the existing realtime refresh hook. No approved Layout/Header/BottomNav changes.
- Existing settlement retry service is NOT reused for cash posting: its old-table lookup and contracts describe a different economic document. C5 reuses local-cache strict persistence and the idempotency-key utility while keeping its own narrowly typed RPC boundary.

## Truth and exact units

No mutable balance or mutable request status. driver_cash_handover_requests and driver_cash_handover_attempts are append-only. A request is pending until a confirmed attempt exists. Discrepancies are separate immutable attempts, not an update that overwrites history.

finance_private.c5_position derives:

- Collected: posted debit to the driver's driver_cash account tied to a completed positive C4 cash event/result.
- Confirmed office received: posted credit to that account tied to a completed C5 confirmed attempt, RCT source and office_cash_received event.
- Remaining: ALL posted debit minus credit in the driver's C2 driver_cash account, with completed operations.
- Reserved: sum of ALL pending request amounts, independent of the displayed page.
- Available: max(remaining - reserved, 0), used for admission only; the actual remaining balance is never clamped or relabeled.

If remaining differs from recognized collected minus confirmed, is negative, or reservations exceed remaining, ledger_requires_review blocks new requests and money confirmation for that driver. This is fail-closed handling of unclassified C2 entries/opening balances/reversals, not a claim that the book is empty. Other drivers/accounts are unaffected. No automatic import, adjustment, reset or invented opening liability is created.

Legacy summary is returned separately by the scoped read RPC and remains separately displayed. It NEVER funds C5 requests and is never added to the C2 balance. C5 never writes old remittance/payout/obligation tables or mirrors old receipts into C2. Operators must not manually record the same physical handover through both independent systems. An old aggregate remittance has no order-specific C4 attribution; C11 conversion is outside this phase.

Every new amount uses exact major SYP, maximum TWO significant decimal places and the existing C2 per-line bound below 10^20. RPC DTOs and stored attempt amounts remain decimal STRINGS in TypeScript; no Number conversion for ledger arithmetic. PostgreSQL redundant trailing scale zeros are normalized without discarding significant digits. FinancialAmount now accepts exact strings as well as its existing number inputs; existing numeric formatting is unchanged. Large ledger sums render through BigInt and must be checked on the phone.

## Reservation policy

Multiple pending requests are allowed. ALL pending amounts reserve custody until exact office confirmation; no automatic expiry, cancellation, forgiveness or release on mismatch is introduced. Partial handover means requesting part of the available balance. Confirming less/more than that request is a discrepancy, not a silent partial receipt.

All C5 writers lock the driver profile first, then request if applicable, then operation/reference/accounts. Supported writer isolation is READ COMMITTED; other isolation levels explicitly fail before writes. This avoids stale-snapshot overbooking at REPEATABLE READ with row-lock-only serialization. The isolated harness verifies the configured default and tests rejection of unsupported isolation. Incoming C4 cash cannot spend custody; the shared profile FK/lock interactions and conservative snapshots require real overlap tests.

## RPC contracts

- request_c5_cash_handover(expected_user uuid, attempt_key uuid, requested_amount numeric)
- confirm_c5_cash_handover(target_request uuid, target_driver uuid, expected_user uuid, attempt_key uuid, counted_amount numeric)
- recover_c5_cash_handover(expected_user uuid, attempt_key uuid)
- get_c5_driver_custody(target_driver uuid, expected_user uuid, page_number integer default 0)
- list_c5_cash_requests(expected_user uuid, state_filter text default 'pending', page_number integer default 0)

Requests require expected_user = auth.uid(), approved driver, admission ON, exact positive amount and available custody after ALL reservations. Request creation writes ONLY a completed idempotency operation and immutable request, not a journal/event/treasury balance. Request and decision completion are checked by deferred triggers.

Confirmation requires current admin role PLUS explicit enabled row in private c5_cash_receivers. That table starts EMPTY and is not editable by runtime roles, including service_role. General admin can read the queue but cannot receive cash without the owner-managed permission. JWT subject, expected driver and actual request ownership are checked before writes. Intake OFF does not prevent completing an existing request. Discrepancies permit a zero counted amount as audit data, never a zero journal.

If counted differs from requested, record a discrepancy decision and completed attempt, leave reservation intact, allocate NO RCT, and post NO money. A later deliberate recount uses a NEW key. Only exact count may confirm, still protecting every other reservation and checking current custody. No discrepancy resolution changes the original request amount.

At confirmation, in ONE transaction:

1. Immutable confirmed decision with actual counted amount, server time and receiving employee.
2. Real RCT reference linked to that decision; office_cash_received event.
3. Existing C2 account definitions: Dr treasury_cash A / Cr driver's driver_cash A. Debit = credit = exact requested/counted A. Full custody movement; no wage or commission subtraction, no new expense/payable/revenue.
4. Completed operation/result, then SET CONSTRAINTS ALL IMMEDIATE before response. Confirmed decisions require their posted receipt/event/journal at transaction end. Any financial/deferred failure rolls back decision, RCT row, event, lines and result together. Sequence gaps are allowed, not duplicate receipts.

Unique confirmed decision per request and unique source/event plus C2 one-journal/event prevent duplicates beyond attempt keys. Same key + changed input is rejected by C2 canonical input checks. Different key + same count for a confirmed request returns its original receipt without posting again. Different count on an already confirmed request is explicitly rejected. Recovery is owner-scoped, read-only and works after lost responses; historical recovery does not grant new office permission.

## Client and UI

src/lib/driver-custody-c5.ts is a HANDWRITTEN runtime boundary for the unapplied migration, not officially generated types. Intent contains actor/driver/action/request/amount/key, is durably saved before sending, validated on restore and re-persisted before explicit retry. A 15-second transport deadline turns timeouts into UNKNOWN, never into proof that a write failed; a late commit is recovered by the same key. Synchronous action locks, before/after identity checks, frozen input and read-first recovery prevent duplicate sends and old-user result exposure. Cache read/write failure blocks writes. Unknown does not retire its key; a changed form cannot fork an unknown attempt. Terminal intents also remain saved until an explicit start-independent-operation action verifies the terminal result and clears persistence. Thus even a rapid repeat after success cannot reserve the same money again under a fresh key. Cleanup failure blocks an independent operation and can only lead to recovery, never reposting.

Driver cash account shows full new custody, reserved/available amounts, partial request form, pending requests and history. Admin custody list embeds the pending/review queue; existing driver details embeds the scoped new balance and counted-money confirmation modal. Existing legacy content remains below, labeled independently. Owner-keyed route contents and scope-tagged readers hide old account/driver rows immediately; late requests are ignored. Read failures show an error and disable new monetary actions, never synthesize zero. Previous same-scope successful data may remain visibly marked stale on ordinary read failures. Identity/permission denial explicitly hides that data, including role revocation without changing user ID. Separate recovery remains available.

Realtime invalidates through RLS-filtered INSERT events on C4 results and the two C5 tables. No C2 private journal is published to drivers. Reconnect/focus reloads and explicit refresh remain available. The publication is changed only if supabase_realtime exists. RPC reads use server pagination (20), stable ordering and full-server reservation totals.

## Local vs actual verification

scripts/test-finance-c5.cjs executes the real TypeScript normalization/DTO/persistence/recovery code with a mocked transport, plus explicit SQL/UI source checks. These are NOT evidence that PostgreSQL/RLS/JWT/concurrency behaves correctly.

supabase/tests/finance_c5_driver_cash_handover.sql is MUTATING, rollback-only and strictly for the pinned disposable local database: partial/multiple reservations, exact decimal input, mismatch/recount, disabled admission, denied permissions/foreign driver, actual C4 source balance, duplicate keys, injected line/deferred failure, full rollback and authenticated-role/claim RLS simulation. NOT a signed JWT test.

scripts/test-finance-c5-postgres.cjs uses existing pinned C2 server/database OID/system identifier/token/fixture guard, numeric loopback *_c2_test only, absolute preinstalled psql and explicit C2+C5 opt-ins. It applies NO migrations and performs NO cleanup. C4 must already have posted genuine synthetic positive custody in that database via its own isolated harness. C5 requests must be initially empty for deterministic tests; the C2 ledger is deliberately NONEMPTY. It verifies fixture marker mappings without C2's old empty-book preflight, not by bypassing identity checks.

It also runs the existing genuine C4 zero-delivery suite with C5 present, requiring c5_position and comparing custody before/after zero. Positive receipts must exist. It proves overlapping reservation and confirmation sessions using the existing pg_blocking_pids observer before COMMIT, then reads committed results, one RCT/event and exhausted new custody while positive legacy custody remains unable to fund C5. Synthetic committed rows remain in the disposable DB. Sequences cannot roll back; no external hooks are allowed there.

Owner-only local invocation AFTER full environment/fixtures have been prepared and the local migrations applied by owner:

```powershell
$env:C2_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C5_ALLOW_DISPOSABLE_TEST = 'yes'
$env:C2_TEST_MANIFEST = 'C:\isolated-tests\manifest.json'
# Set C2_TEST_DATABASE_URL privately to the pinned numeric-loopback *_c2_test DB.
node scripts/test-finance-c5-postgres.cjs
```

Manifest includes original C2 fixture mappings, c3Products (three synthetic available products in separate accepted stores with valid subscriptions), c4OtherDriver and pinned database identity. Do NOT run a test harness or mutating SQL suite on the linked Supabase project.

Actual PostgreSQL execution, signed JWTs/PostgREST grants/RLS, overlapping writers, nonempty-book migration application, realtime and phone/network-loss testing remain NOT RUN. No PostgreSQL tooling/environment is installed or created by this task. C2/C4 behavioral tests remain pending and are not declared successful.

## Owner review and rollout

Status: READY FOR OWNER REVIEW / READY FOR ISOLATED TEST, admission OFF. Not remote deployment/activation approval. Before any remote activation: review/apply order, run the isolated suites and signed JWT tests, test phone amounts/RTL/themes/recovery/realtime, verify the target book has no unexplained driver_cash movements, and explicitly assign receiving employees. Both intake and receiver permissions are separate owner-managed configuration; neither is enabled by migration. Turning new intake OFF never cancels existing reservations or blocks authorized confirmation.

No C6 wages, C7 payouts/settlements, legacy conversion, new monetary adjustment, or discrepancy write-off is implemented. Cancellation/expiry and exceptional ledger movements require separate approved contracts; they are never inferred here.
## Recorded local verification for this delivery

- PASS: TypeScript noEmit; Expo lint (0 errors, 6 pre-existing warnings outside C5); git diff --check; new/untracked touched-file whitespace; JavaScript syntax checks for the guarded PostgreSQL harness.
- PASS: 25 C5 offline cases (real TypeScript paths under mocked transport, imperative scoped reader and explicit source checks).
- PASS: C2 contract 10, test guard 6, C3 38, C4 20, atomic delivery client 14, driver collection 14, merchant finance workflow 31; additional report/account contract scripts. Total numbered local checks: 158. None are a claim of real PostgreSQL behavior.
- NOT RUN: PostgreSQL migrations/suites, COMMIT/concurrency harness, signed JWT/PostgREST RLS and phone/realtime/network-loss verification. No psql/postgres/pg_ctl found on PATH and no pinned C5 test environment configured. No service/tool installation, remote database access or migration application occurred.
