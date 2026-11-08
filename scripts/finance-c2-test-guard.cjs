// Test tooling only. Importing this module performs no I/O or connection.
const path = require('node:path');
const fixtureNames = ['admin','driver','customer','merchant','otherMerchant','merchantOwner','otherMerchantOwner',
  'order','otherOrder','child','otherChild','task','otherTask','orderWithoutTask'];
function uuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) throw new Error('Invalid synthetic fixture UUID');
  return value;
}
function buildConfig(input, manifest) {
  if (input.C2_ALLOW_DISPOSABLE_TEST !== 'yes') throw new Error('Explicit disposable-test opt-in required');
  const url = new URL(input.C2_TEST_DATABASE_URL || '');
  const host = url.hostname === '[::1]' ? '::1' : url.hostname;
  const database = decodeURIComponent(url.pathname.slice(1));
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const port = url.port || '5432';
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1','::1'].includes(host)
    || !/^[a-z][a-z0-9_]*_c2_test$/.test(database) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(user)
    || !password || url.search || url.hash) throw new Error('Explicit numeric loopback endpoint and credentials required');
  if (manifest.version !== 1 || manifest.host !== host || String(manifest.port) !== port || manifest.database !== database
    || !/^\d+$/.test(manifest.databaseOid || '') || !/^\d+$/.test(manifest.systemIdentifier || '')
    || !path.isAbsolute(manifest.psqlPath || '')) throw new Error('Trusted manifest does not match endpoint');
  const fixtures = Object.fromEntries(fixtureNames.map(name => [name,uuid(manifest.fixtures?.[name])]));
  if (new Set(Object.values(fixtures)).size !== fixtureNames.length) throw new Error('Fixtures must be distinct');
  // No inherited PG*, PATH search, home directory, service file or PGOPTIONS.
  const env = { PGPASSWORD:password, PGCONNECT_TIMEOUT:'5', PGCLIENTENCODING:'UTF8' };
  for (const key of ['SystemRoot','WINDIR','TEMP','TMP']) if (input[key]) env[key]=input[key];
  return { host,port,database,env,fixtures,token:uuid(manifest.token),databaseOid:manifest.databaseOid,
    systemIdentifier:manifest.systemIdentifier,psqlPath:manifest.psqlPath,
    args:['-X','-qAt','-v','ON_ERROR_STOP=1','-h',host,'-p',port,'-U',user,'-d',database] };
}
function identityAssertion(config) {
  // A separate read-only transaction in EVERY psql session, before test SQL.
  return `begin read only;
    do $$ begin
      if current_database() is distinct from '${config.database}'
        or (select oid::text from pg_database where datname=current_database()) is distinct from '${config.databaseOid}'
        or (select system_identifier::text from pg_control_system()) is distinct from '${config.systemIdentifier}'
        or host(inet_server_addr()) is distinct from '${config.host}'
        or inet_server_port() is distinct from ${config.port}
        or (select token::text from c2_test_guard.environment where singleton) is distinct from '${config.token}' then
        raise exception 'isolated database identity/marker mismatch';
      end if;
    end $$; commit;\n`;
}
function fixtureQuery(config) {
  const f = config.fixtures;
  return `begin read only;
    select jsonb_build_object('database',current_database(),
      'databaseOid',(select oid::text from pg_database where datname=current_database()),
      'systemIdentifier',(select system_identifier::text from pg_control_system()),
      'host',host(inet_server_addr()),'port',inet_server_port(),
      'token',(select token::text from c2_test_guard.environment where singleton),
      'fixtures',(select jsonb_object_agg(name,id::text) from c2_test_guard.fixtures),
      'valid',(
        exists(select 1 from public.profiles where id='${f.admin}' and role='admin')
        and exists(select 1 from public.profiles where id='${f.driver}' and role='driver')
        and exists(select 1 from public.customer_orders co join public.profiles p on p.id=co.customer_id where co.id='${f.order}' and p.id='${f.customer}' and p.role='customer')
        and exists(select 1 from public.customer_orders where id='${f.otherOrder}' and customer_id='${f.customer}')
        and exists(select 1 from public.customer_orders where id='${f.orderWithoutTask}' and customer_id='${f.customer}')
        and not exists(select 1 from public.delivery_tasks where customer_order_id='${f.orderWithoutTask}')
        and exists(select 1 from public.store_orders so join public.stores s on s.id=so.store_id
          join public.merchants m on m.id=s.merchant_id join public.profiles p on p.id=m.owner_user_id
          where so.id='${f.child}' and so.customer_order_id='${f.order}' and p.role='merchant' and p.id='${f.merchantOwner}' and m.id='${f.merchant}')
        and exists(select 1 from public.store_orders so join public.stores s on s.id=so.store_id
          join public.merchants m on m.id=s.merchant_id join public.profiles p on p.id=m.owner_user_id
          where so.id='${f.otherChild}' and so.customer_order_id='${f.otherOrder}' and p.role='merchant' and p.id='${f.otherMerchantOwner}' and m.id='${f.otherMerchant}'
          and s.merchant_id<>(select s2.merchant_id from public.store_orders so2 join public.stores s2 on s2.id=so2.store_id where so2.id='${f.child}'))
        and exists(select 1 from public.delivery_tasks where id='${f.task}' and customer_order_id='${f.order}'
          and (driver_id is null or driver_id='${f.driver}'))
        and exists(select 1 from public.delivery_tasks where id='${f.otherTask}' and customer_order_id='${f.otherOrder}'
          and (driver_id is null or driver_id='${f.driver}'))
        and not exists(select 1 from public.order_lifecycle_events where customer_order_id in ('${f.order}','${f.orderWithoutTask}'))
        and not exists(select 1 from public.financial_accounts)
      )); rollback;`;
}
async function preflight(config, query) {
  let actual;
  try { actual=JSON.parse(await query(fixtureQuery(config))); } catch { throw new Error('Synthetic fixture preflight unavailable'); }
  if (actual.database !== config.database || actual.databaseOid !== config.databaseOid
    || actual.systemIdentifier !== config.systemIdentifier || actual.host !== config.host
    || String(actual.port) !== config.port || actual.token !== config.token) throw new Error('Actual connection identity mismatch');
  if (actual.valid !== true) throw new Error('Synthetic fixture relationships or clean C2 state failed');
  for (const name of fixtureNames) {
    if (actual.fixtures?.[name] !== config.fixtures[name]) throw new Error(`Synthetic marker mismatch: ${name}`);
  }
}
module.exports = { buildConfig, identityAssertion, fixtureQuery, preflight, fixtureNames };
