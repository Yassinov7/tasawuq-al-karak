-- OPTIONAL OWNER READ ONLY. Run ONLY if main file reports to_regclass('cron.job') NOT NULL.
-- Every active job requires owner review. Commands/URLs/headers/secrets are NEVER printed.
begin transaction isolation level repeatable read read only;
select jobid,schedule,active,md5(command) as command_fingerprint,
 command ~* '(subscription|finance|treasury|journal|c[2-9]_|c1[01]_)' as financial_keyword_hint
from cron.job where active order by jobid;
-- ZERO rows is the expected dormant baseline; hints cannot prove absence of indirect job calls.
rollback;
