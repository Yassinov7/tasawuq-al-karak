// Opt-in live SQL test. Never accepts a remote host or the application database.
// Uses only Node built-ins and a preinstalled psql. No packages/services installed.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildConfig,identityAssertion,preflight } = require('./finance-c2-test-guard.cjs');

function createPsql(config, launch = spawn) {
  return function sql(statement, extraArgs = []) {
    return new Promise((resolve, reject) => {
      const child = launch(config.psqlPath, [...config.args,...extraArgs], { env:config.env, windowsHide:true });
      const timer = setTimeout(() => { child.kill(); reject(new Error('psql timeout')); },30000);
      let output = '';
      let errors = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { errors += chunk; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); if(code===0) resolve(output.trim()); else reject(new Error(errors || `psql exit ${code}`)); });
      child.stdin.end(identityAssertion(config) + statement);
    });
  };
}

async function main() {
  const manifestPath = process.env.C2_TEST_MANIFEST;
  if (!path.isAbsolute(manifestPath || '')) throw new Error('Absolute trusted local manifest path required');
  const config = buildConfig(process.env,JSON.parse(fs.readFileSync(manifestPath,'utf8')));
  if (!fs.statSync(config.psqlPath).isFile()) throw new Error('Preinstalled psql executable required');
  const uuid = value => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) {
      throw new Error('Synthetic C2_TEST_ADMIN and C2_TEST_ORDER UUID fixtures are required.');
    }
    return value;
  };
  const actor = config.fixtures.admin;
  const order = config.fixtures.order;
  const otherOrder = config.fixtures.otherOrder;
  const runId = randomUUID();
  const sql = createPsql(config);
  await preflight(config,sql);
  const f = config.fixtures;
  const variables = {admin_user:actor,driver_user:f.driver,order_id:order,other_order_id:otherOrder,
    child_id:f.child,other_child_id:f.otherChild,task_id:f.task,other_task_id:f.otherTask,no_task_order_id:f.orderWithoutTask};
  await sql(fs.readFileSync(path.join(__dirname,'../supabase/tests/finance_c2_foundation.sql'),'utf8'),
    Object.entries(variables).flatMap(([name,value]) => ['-v',`${name}=${value}`]));
  console.log('PASS transactional SQL foundation tests');
  const auth = `select set_config('request.jwt.claim.sub','${actor}',true);`;
  await sql(`begin; ${auth}
    do $$ begin
      if not public.is_admin() then raise exception 'admin fixture missing'; end if;
      if not exists(select 1 from public.customer_orders where id='${order}') then raise exception 'order fixture missing'; end if;
    end $$;
    insert into public.financial_accounts(definition_code) values ('treasury_cash'),('delivery_revenue') on conflict do nothing;
    select finance_private.register_document('ORD','${order}'); commit;`);

  const operationKey = randomUUID();
  function posting(key, event, reversal = null) {
    const debitCode = reversal ? 'delivery_revenue' : 'treasury_cash';
    const creditCode = reversal ? 'treasury_cash' : 'delivery_revenue';
    return `begin; ${auth}
      do $$ declare op public.financial_operations%rowtype; source uuid; v_event_id uuid; journal uuid; debit_id uuid; credit_id uuid;
      begin
        op := finance_private.begin_operation('c2_concurrency','${key}','{"amount":"1"}');
        if op.state in ('completed','rejected') then return; end if;
        perform pg_sleep(0.3);
        select id into source from public.financial_document_references where kind='ORD' and document_id='${order}';
        v_event_id := finance_private.record_financial_event(source,'${event}',op.id);
        select j.id into journal from public.journal_entries j where j.event_id=v_event_id;
        if journal is null then
          select id into debit_id from public.financial_accounts where definition_code='${debitCode}';
          select id into credit_id from public.financial_accounts where definition_code='${creditCode}';
          journal := finance_private.post_journal(v_event_id,jsonb_build_array(
            jsonb_build_object('account_id',debit_id,'side','debit','amount','1'),
            jsonb_build_object('account_id',credit_id,'side','credit','amount','1')),'C2 concurrency fixture',${reversal ? `'${uuid(reversal)}'` : 'null'});
        end if;
        perform finance_private.complete_operation(op.id,jsonb_build_object('entry_id',journal));
      end $$; commit;`;
  }
  const event = `c2:${runId}:same-key`;
  await Promise.all([sql(posting(operationKey, event)), sql(posting(operationKey, event))]);
  assert.equal(await sql(`select count(*) from public.journal_entries j join public.financial_events e on e.id=j.event_id where e.event_type='${event}';`), '1');
  assert.equal(await sql(`select count(*) from public.financial_operations where actor_id='${actor}' and attempt_key='${operationKey}';`), '1');
  console.log('PASS concurrent same-key retries commit one operation and one journal');

  const secondEvent = `c2:${runId}:different-key`;
  await Promise.all([sql(posting(randomUUID(), secondEvent)), sql(posting(randomUUID(), secondEvent))]);
  assert.equal(await sql(`select count(*) from public.journal_entries j join public.financial_events e on e.id=j.event_id where e.event_type='${secondEvent}';`), '1');
  console.log('PASS different attempt keys cannot duplicate an economic journal');
  const original = uuid(await sql(`select j.id from public.journal_entries j join public.financial_events e on e.id=j.event_id where e.event_type='${event}';`));
  const reversals = await Promise.allSettled([
    sql(posting(randomUUID(),`c2:${runId}:reverse-a`,original)),
    sql(posting(randomUUID(),`c2:${runId}:reverse-b`,original)),
  ]);
  assert.equal(reversals.filter(item=>item.status==='fulfilled').length,1);
  const rejected = reversals.find(item=>item.status==='rejected');
  assert.match(rejected.reason.message,/journal_entries_reversal_of_key/);
  assert.equal(await sql(`select count(*) from public.journal_entries where reversal_of='${original}';`),'1');
  console.log('PASS concurrent reversal of one original commits once');

  function timeline(key) {
    return `begin; ${auth} select finance_private.append_lifecycle_event('${order}',null,null,'c2_concurrency',null,null,'c2_test','${key}'); select pg_sleep(0.3); commit;`;
  }
  const timelineKey = `c2:${runId}:timeline`;
  await Promise.all([sql(timeline(timelineKey)), sql(timeline(timelineKey))]);
  assert.equal(await sql(`select count(*) from public.order_lifecycle_events where customer_order_id='${order}' and natural_key='${timelineKey}';`), '1');
  await Promise.all([sql(timeline(`${timelineKey}:a`)), sql(timeline(`${timelineKey}:b`))]);
  assert.equal(await sql(`select count(*)=count(distinct order_sequence) from public.order_lifecycle_events where customer_order_id='${order}';`), 't');
  console.log('PASS concurrent lifecycle retries are unique and per-order sequence is serialized');

  const referenceOrders = [order, otherOrder];
  await Promise.all(referenceOrders.map(id => sql(`begin; select finance_private.register_document('ORD','${id}'); commit;`)));
  assert.equal(await sql(`select count(*)=count(distinct public_reference) from public.financial_document_references;`), 't');
  console.log('PASS concurrent reference registration preserves uniqueness');
  const allocated = await Promise.all(Array.from({ length: 8 }, () => sql("select public_reference from finance_private.next_reference('INV');")));
  assert.equal(new Set(allocated).size, allocated.length);
  assert.ok(allocated.every(value => /^INV-\d{6,}$/.test(value)));
  console.log('PASS independent sessions allocate unique reference numbers without creating fake documents');
  console.log('These committed synthetic records remain only in the disposable local test database.');
}
module.exports = {createPsql};
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
