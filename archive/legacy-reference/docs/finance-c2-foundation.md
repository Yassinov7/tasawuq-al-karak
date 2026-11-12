# Finance Rebuild C2

## Scope and deployment state

The migration is `supabase/migrations/20261105000100_finance_c2_foundation.sql`.
It requires the existing migrated application schema, including SYP-only.
It does not depend on running the branding migration again.
It has not been applied remotely by this task. PostgreSQL execution remains a
separate acceptance requirement. The TypeScript contract is provisional and
does not replace the remote-generated `src/types/database.ts`.

This migration adds tables, private helpers and two read RPCs. It does not attach
triggers to existing tables, change an existing RPC or create financial postings
for existing data. The chart definitions contain no money. There is no opening
balance, account balance column, wallet implementation or enabled business writer.

## Objects and trust boundary

- `financial_account_definitions` defines 13 purposes and their required owners.
- `financial_accounts` identifies system, merchant, driver and customer accounts.
  System accounts cannot have owners. Merchant accounts require a merchant FK.
  Driver/customer accounts require a profile of the corresponding role.
  Partial unique indexes prevent duplicate account purposes per party.
- `financial_document_references` binds a reference to an actual source UUID.
  Explicit FKs support ORD, SUB, DLV, MSB, SIN and TXN. The TXN FK is deferred
  solely to allow the journal/reference cycle in one transaction.
- `financial_operations` stores actor, role snapshot, attempt UUID, canonical
  JSONB input and a completed or rejected result. A pending operation cannot commit.
- `financial_events` has one natural event per source document and event type.
- `journal_entries` has one entry per financial event and a generated TXN.
- `journal_lines` contains positive integral SYP amounts and account/side links.
- `order_lifecycle_events` stores immutable server events ordered within an ORD.

The `finance_private` schema has no USAGE for PUBLIC, anon, authenticated or
service_role. All its functions and sequences explicitly revoke permissions
from these roles. Every definer function has an empty search_path and qualified
object names. Future dedicated public RPCs must resolve ownership, state,
canonical input, source document, account IDs and amounts server-side before
calling private helpers. Never expose `post_journal` or its JSON line input.

All eight public C2 tables have RLS enabled. Authenticated users have SELECT
grants but policies permit only `is_admin()`. They have no DML grants.
Anonymous and service-role requests have no table grants. Database owners remain
trusted PostgreSQL administrators. This is intentionally a raw-ledger boundary;
future merchant/driver/customer statements need narrow, owned projections.

`get_c2_financial_operation(uuid)` returns only the signed-in actor's final
result and operation_state (completed/rejected). It does not return canonical input.
`find_c2_document_reference(text)` checks authenticated admin status before exact
reference lookup. No broad participant ledger or reference-search RPC is enabled.

## Amounts, immutability and reversals

Line amounts use unscaled `numeric` with integer, positivity, finite-value and
20-digit range CHECKs. A numeric(20,0) typmod would round fractional input before
the CHECK and therefore would not meet the requirement to reject fractions.
No JavaScript Number conversion is used for twenty-digit amounts in the C2 TS
contract. Amounts cross that boundary as validated decimal strings.

A journal is `building` only within its transaction. Inserting a line locks its
parent entry and requires `building`. Entries may only move from building to
posted. Identity, source, reference, reason and reversal links cannot change.
Lines cannot be updated or deleted, including during building. A failure rolls
back the construction instead of editing it.

`post_journal` locks the economic event, creates all lines, posts and checks the
whole journal immediately. Deferred constraint triggers recheck balance and
posted status at transaction completion, protecting direct privileged SQL too.
Both debit and credit totals must be positive and equal. The entry lock prevents
a concurrent line insertion from changing a posted entry.

C2 supports exact, full reversals only. A reversal must invert the original
account/side aggregates, remain balanced and reference one original posted
entry. UNIQUE(reversal_of) prevents reversing it twice. Partial corrections and
cash refunds need dedicated documents and allocation rules in later phases;
an accounting reversal is not evidence that cash physically moved.

## Calling protocol for future dedicated RPCs

1. Authenticate the actor and authorize the specific operation.
2. Build canonical business input from validated values. JSONB removes object-key
   order differences but does not normalize numeric strings, arrays or business
   defaults. The dedicated RPC owns that normalization.
3. Call `begin_operation`. Return the stored result immediately if completed.
4. Lock the parent business document before its children. Register its reference.
5. Call `record_financial_event`. This locks the reference and returns an existing
   natural event even when another attempt UUID was supplied.
6. If a journal already exists for that event, verify source semantics, recover
   the existing result and complete the current attempt. Do not post again.
7. Otherwise resolve the accounts and amounts from trusted business state, then
   call `post_journal`.
8. Complete the operation with the persisted document IDs before committing.

### Failed attempts and economic facts

A deferred `financial_event_complete` constraint requires every financial event
to have its posted journal and a completed, successful originating operation.
The operation completion guard rejects an attached unposted event immediately,
including the old `{"rejected":true}` completion pattern. Rejected operations
cannot have economic events.

Keep begin_operation outside a PL/pgSQL exception block. Create the event and
post its journal inside that block. On a definite business rejection the block
must roll back the event, reference/journal construction and lines, then call
`complete_operation(id, result, true)` on the surviving attempt. Do not catch an
error and complete while leaving its event attached. Unexpected failures should
abort the whole transaction. A new attempt may perform the same economic event
after rejection because no event was reserved. Replaying the rejected key returns
its rejected result. Replaying a successful key returns its original result.

### Constraint timing and cost

The TXN reference still needs its deferred FK because its trigger inserts the
reference before the journal row. `begin_operation`, `record_financial_event`
and `post_journal` call a private helper that explicitly defers only the five C2
construction constraints. Thus entering under SET CONSTRAINTS ALL IMMEDIATE is
supported. Force ALL IMMEDIATE after completing the operation to validate it.
Forcing constraints in the middle of unfinished construction must fail.

The per-line deferred balance checks are retained. They can repeatedly aggregate
the same journal (potential quadratic work for large entries). No performance
claim or optimization is made without actual PostgreSQL measurement.

Whole transactions must retry on serialization/deadlock failures using the same
attempt key. Do not retry only the last statement. The standard resource order
is operation, parent order/business document, reference/event, journal, then any
further resource IDs sorted consistently. Event writers must not lock these in
the reverse order. Natural event types come from dedicated server code, never
from arbitrary client strings. Each receipt/payment will have its own source
document, permitting many payments without duplicating one payment event.

C2 requires an authenticated profile for operation/event actor snapshots.
Scheduled renewal needs an explicit trusted-system actor protocol in C8.
Do not impersonate an arbitrary user to work around this constraint.

## Reference activation

All eleven sequences exist, with no application access. Formatting uses at least
six digits and widens for longer bigint values. Sequence gaps after rollback are
expected and references are never recycled.

TXN is assigned to every new C2 journal. No references are backfilled and no
order-creation path calls the registry yet. `register_document` supports existing
ORD/SUB/DLV/MSB/SIN rows only when a future trusted RPC explicitly invokes it.
There are no new reference columns or triggers on the old tables.

INV/SET/RCT/PAY/ADJ sequences are reserved. Their source documents do not exist
in the rebuilt schema yet. Their registry adapters deliberately fail closed.
Later migrations must add typed FK bindings and update the registry CHECK and
private adapter when those real documents are implemented. Merely allocating a
number does not create a document or bypass authorization.

## Timeline activation

The internal append function locks ORD, verifies optional SUB/DLV membership,
recovers the natural-key event, and rejects changed replay input. A BEFORE INSERT
trigger stamps auth.uid(), profiles.role and clock_timestamp() after the parent
lock, then assigns the next per-order sequence. Even privileged accidental input
cannot choose these values. Corrections append a new event linked to an original
in the same order with a reason. The original remains unchanged.

No old transition RPC invokes this function in C2. C3/C4 will append events in
the same transaction as state changes. Natural keys must include entity UUIDs
and the server transition identity. Future SQL readers will join reference rows
by kind and source UUID rather than accepting reference text from the phone.
Missing/reversed timestamps produce unavailable metrics, not zero durations.

## Confirmed C3-C9 business decisions

- No DLV on ORD creation. Create one task only after all included SUB are ready,
  exclusions resolved and the final amount fixed. All-excluded orders have none.
- A rejected store removes its goods and recomputes fees using the original zone
  snapshot and remaining distinct store count. Keep original and revised values,
  reason and customer notification. An increase requires customer approval.
- Zone fees, additional-store rate and active primary zone are admin settings.
  No regional name or fixed percentage belongs in application pricing code.
- Cash on delivery requires manually entered actual cash equal to the final
  required amount. Mismatch escalates; no automatic customer debt.
- Driver custody includes all actual cash, without wage deduction. Partial office
  receipts allocate to tasks. Default wage is 70%, snapshotted per task, released
  only after closing the task's full custody and paid by a separate PAY.
- Commission accrues once on successful SUB delivery and reduces merchant sales
  payable once. Subscription debt and sales payable never offset each other.
- Subscription revenue is fully recognized on invoice issue. Later cash closes
  receivable, with no second revenue entry. This is project policy.
- Round line totals to whole SYP, compute commission on fixed store totals, round
  wage and assign delivery-fee remainder to platform. Bundle residual allocation
  uses integers and cannot create negative components. C2 does not implement
  those pricing functions.
- Each functional phase integrates its references immediately. C10 audits them.
- Old/new writers must never post the same economic event concurrently.

## Verification and acceptance

Local source/TypeScript checks are `node scripts/test-finance-c2.cjs`,
`npx.cmd tsc --noEmit`, `npx.cmd expo lint` and `git diff --check`.
The local contract suite is not proof of SQL behavior.

`supabase/tests/finance_c2_foundation.sql` runs transactionally after all previous
migrations and C2 on a disposable local database. Supply synthetic admin,
customer-owned order, child/task, another merchant's child/task and a driver.
All four roles must be represented. The C2 test account purposes and timeline
fixtures must be unused. Missing fixtures fail. It tests real postings, exact
reversal, deferred rejection, fractional/negative rejection, replay, parent
relations, timestamps and actual SET ROLE authenticated/anon RLS reads.
It also posts the 110000/100000/10000, 10% commission and 70% wage example and the
30000 subscription example, asserting 13000 treasury and one subscription income.
Rows roll back; sequence gaps can remain.

`scripts/test-finance-c2-guard.cjs` performs offline simulations. It imports the
actual connection guard and uses a fake process launcher. It verifies that hostile
PGHOSTADDR, PGSERVICE, PGSERVICEFILE, PGOPTIONS and related inherited settings do
not reach psql, that explicit endpoint arguments are present, and that read-only
identity checks precede any test SQL. No real process or connection is started.

`scripts/test-finance-c2-postgres.cjs` is an opt-in, multi-connection psql harness.
It now requires explicit numeric loopback (127.0.0.1 or ::1), a strict database
name ending `_c2_test`, credentials and an absolute preinstalled psql path. URL
query options are rejected. The child gets an allowlisted environment only, with
explicit host/port/user/database arguments and `-X`/ON_ERROR_STOP. It does not
inherit PATH, home config, service variables, hostaddr or PGOPTIONS.

### Provisioning the isolated environment (not performed by this task)

Only the owner/test administrator prepares a disposable local PostgreSQL cluster
with the actual preceding Supabase schema, roles and required Auth/Storage
dependencies, then applies the reviewed C2 file there. A bare empty PostgreSQL
database is insufficient. Do not connect this harness to the primary project or
use a tunnel to it. The owner alone applies migrations to Supabase.

In that LOCAL TEST database only, the administrator creates schema
`c2_test_guard`, table `environment(singleton boolean primary key check
(singleton), token uuid not null)` with exactly one row, and table
`fixtures(name text primary key, id uuid not null unique)`. Revoke all privileges
on this schema and these tables from PUBLIC/anon/authenticated/service_role.
These are test-only objects and deliberately absent from the application
migration. Their marker attests that the administrator created synthetic data;
it must never be minted by the runner to bypass a failed check.

Prepare a trusted local JSON manifest outside the repository with these fields:

```json
{
  "version": 1,
  "host": "127.0.0.1",
  "port": 5432,
  "database": "tasawuq_c2_test",
  "databaseOid": "<actual local database OID as decimal text>",
  "systemIdentifier": "<actual local pg_control_system identifier as decimal text>",
  "token": "<test marker UUID>",
  "psqlPath": "C:\\absolute\\installed\\PostgreSQL\\bin\\psql.exe",
  "fixtures": {
    "admin": "<UUID>", "driver": "<UUID>", "customer": "<UUID>",
    "merchant": "<UUID>", "otherMerchant": "<UUID>",
    "merchantOwner": "<UUID>", "otherMerchantOwner": "<UUID>",
    "order": "<UUID>", "otherOrder": "<UUID>", "orderWithoutTask": "<UUID>",
    "child": "<UUID>", "otherChild": "<UUID>", "task": "<UUID>", "otherTask": "<UUID>"
  }
}
```

Every fixture name/UUID must also be attested in `c2_test_guard.fixtures`. The
three orders belong to the marked customer, the children to distinct marked
merchants and their marked owners, and the tasks to the corresponding parents.
The third order has no DLV row, using a dedicated local fixture rather than
changing the existing order-creation RPC. Start with unused C2 accounts and
timelines. No customer data from the real project belongs in these fixtures.

Configure `C2_ALLOW_DISPOSABLE_TEST=yes`, `C2_TEST_MANIFEST=<absolute JSON path>`
and `C2_TEST_DATABASE_URL=<matching numeric-loopback URL with test credentials>`.
Do not commit credentials or the local manifest. Run the Node harness only after
the offline guard tests pass.

Before any write, the runner checks all configuration and fixture UUIDs, then
reads the database OID, cluster system identifier, actual server IP/port and
trusted marker. Every new psql session checks the same identity in a read-only
transaction before executing test SQL. Missing markers, permissions or mismatches
stop execution. All fixture roles, ownership, relationships, no-DLV condition and
clean C2 state are checked before the first test write. Identity cannot be
established securely from a suffix alone.

The harness first runs finance_c2_foundation.sql with all validated variables.
That rollback-only suite now tests an orphan event, rejected-attempt recovery,
direct nonempty unbalanced posting, wrong-account reversal, no-DLV timeline,
actual reference generation after 999999, direct role writes and ALL IMMEDIATE.
The sequence-boundary test uses transactional ALTER SEQUENCE RESTART inside a
rolled-back exception block, never setval on the main project.

It then tests committed concurrent same/different-key retries, two reversals of
one original, timeline order and independent reference generation. These leave
synthetic records in the disposable database. Recreate that database through its
normal test administration process before another clean run. No cleanup or
destructive command is included for the primary project.

Protection assumes the manifest and executable are trusted and the isolated
server is administered correctly. The runner cannot attest an isolation claim
by an adversarial database administrator. No real connection is approved until
the local environment and manifest can actually be verified.

If PostgreSQL/psql is absent, stop at offline checks. Do not install Docker or a
service and do not redirect these tests to the primary Supabase project.

Before acceptance, run SQL and concurrency tests, review actual grants/owners,
generate types from a legitimately migrated schema into a separate file, and
verify that old order and finance regression tests still pass. The production
activation/cleanup plan remains C11. No db push is authorized by this document.
