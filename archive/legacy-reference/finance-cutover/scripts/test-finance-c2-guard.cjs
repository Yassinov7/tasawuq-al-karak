const assert = require('node:assert/strict');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const {createPsql} = require('./test-finance-c2-postgres.cjs');
const {buildConfig,identityAssertion,preflight,fixtureNames} = require('./finance-c2-test-guard.cjs');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
const fixtures = Object.fromEntries(fixtureNames.map((name,index)=>[name,id(index+1)]));
const manifest = {version:1,host:'127.0.0.1',port:5432,database:'isolated_c2_test',databaseOid:'12345',
  systemIdentifier:'1234567890123456789',token:id(100),psqlPath:path.resolve('local-test-psql.exe'),fixtures};
const input = {C2_ALLOW_DISPOSABLE_TEST:'yes',C2_TEST_DATABASE_URL:'postgresql://tester:secret@127.0.0.1/isolated_c2_test',
  PGHOSTADDR:'203.0.113.10',PGSERVICE:'remote',PGSERVICEFILE:'remote.conf',PGSYSCONFDIR:'remote',
  PGOPTIONS:'-c role=postgres',PGDATABASE:'primary',PGUSER:'remote',PGHOST:'remote',PGPASSFILE:'remote',
  PGPASSWORD:'inherited',PATH:'untrusted',HOME:'untrusted',APPDATA:'untrusted'};
let count=0;
function test(name,run) { run(); count++; console.log(`PASS ${name}`); }
async function main() {
  const config = buildConfig(input,manifest);
  test('hostaddr, service, options, credentials and config directories are not inherited',()=>{
    assert.deepEqual(Object.keys(config.env).sort(),['PGCLIENTENCODING','PGCONNECT_TIMEOUT','PGPASSWORD']);
    assert.equal(config.env.PGPASSWORD,'secret');
    assert.ok(config.args.includes('127.0.0.1'));
    assert.ok(config.args.includes('isolated_c2_test'));
    assert.equal(config.psqlPath,manifest.psqlPath);
  });
  test('remote, DNS, conninfo-like names and URL query overrides fail closed',()=>{
    for (const url of ['postgresql://tester:secret@example.com/isolated_c2_test',
      'postgresql://tester:secret@localhost/isolated_c2_test','postgresql://tester:secret@127.0.0.1/primary',
      'postgresql://tester:secret@127.0.0.1/host%3Dremote_c2_test',
      'postgresql://tester:secret@127.0.0.1/isolated_c2_test?hostaddr=203.0.113.10']) {
      assert.throws(()=>buildConfig({...input,C2_TEST_DATABASE_URL:url},manifest));
    }
  });
  test('all fixtures and distinctness are validated before a query can be created',()=>{
    for (const name of fixtureNames) assert.throws(()=>buildConfig(input,{...manifest,fixtures:{...fixtures,[name]:undefined}}));
    assert.throws(()=>buildConfig(input,{...manifest,fixtures:{...fixtures,otherOrder:fixtures.order}}));
    assert.throws(()=>buildConfig(input,{...manifest,psqlPath:'psql'}));
    assert.throws(()=>buildConfig(input,{...manifest,databaseOid:'invalid'}));
    assert.throws(()=>buildConfig({...input,C2_ALLOW_DISPOSABLE_TEST:'no'},manifest));
  });
  test('each connection checks server, database OID, system identity and test token read-only',()=>{
    const sql=identityAssertion(config);
    for (const value of ['begin read only','pg_control_system()','inet_server_addr()','inet_server_port()',
      'pg_database','c2_test_guard.environment',config.token,config.systemIdentifier]) assert.ok(sql.includes(value));
    assert.doesNotMatch(sql,/\b(insert|update|delete|truncate|drop)\b/i);
    assert.match(sql,/is distinct from/);
  });
  let processCalls=0;
  const mockedQuery=createPsql(config,(executable,args,options)=>{
    processCalls++;
    assert.equal(executable,manifest.psqlPath);
    assert.deepEqual(options.env,config.env);
    for(const name of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGDATABASE','PATH']) assert.equal(options.env[name],undefined);
    assert.ok(args.includes('ON_ERROR_STOP=1'));
    const child=new EventEmitter();
    child.stdout=new EventEmitter();
    child.stderr=new EventEmitter();
    child.stdin={end(statement){
      assert.ok(statement.indexOf('begin read only;')<statement.indexOf('select 1;'));
      queueMicrotask(()=>{child.stdout.emit('data','1\n');child.emit('close',0);});
    }};
    return child;
  });
  assert.equal(await mockedQuery('select 1;'),'1');
  assert.equal(processCalls,1);
  count++;
  console.log('PASS actual process boundary receives only approved environment and identity-first SQL');
  let calls=0;
  const validReply={valid:true,fixtures,host:config.host,port:Number(config.port),database:config.database,
    databaseOid:config.databaseOid,systemIdentifier:config.systemIdentifier,token:config.token};
  await preflight(config,async sql=>{
    calls++;
    assert.match(sql,/^begin read only/);
    assert.doesNotMatch(sql,/\b(insert|update|delete|truncate|drop)\b/i);
    return JSON.stringify(validReply);
  });
  assert.equal(calls,1);
  for (const reply of [JSON.stringify({...validReply,valid:false}),JSON.stringify({...validReply,fixtures:{}}),'invalid']) {
    await assert.rejects(()=>preflight(config,async()=>reply));
  }
  await assert.rejects(()=>preflight(config,async()=>{throw Error('identity or marker missing');}));
  for (const field of ['host','port','database','databaseOid','systemIdentifier','token']) {
    await assert.rejects(()=>preflight(config,async()=>JSON.stringify({...validReply,[field]:'mismatch'})));
  }
  count++;
  console.log('PASS missing identity, marker or fixture proof cannot reach test writes');
  console.log(`${count} offline guard tests passed. No psql process or connection was started.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
