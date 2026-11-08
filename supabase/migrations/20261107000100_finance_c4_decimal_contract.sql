-- OWNER REVIEW ONLY. Major SYP, never x100. No historical values are rewritten.
begin;
lock table public.journal_entries, public.journal_lines in share row exclusive mode;
do $$
declare constraint_name text; matches integer;
begin
  if exists(select 1 from public.journal_lines where amount<=0
    or amount>=100000000000000000000 or amount::text in ('NaN','Infinity','-Infinity')
    or amount<>round(amount,2)) then
    raise exception 'C4 decimal preflight: invalid existing journal amount; owner review required';
  end if;
  if exists(select 1 from public.journal_entries e left join public.journal_lines l on l.journal_entry_id=e.id
    group by e.id,e.status having e.status<>'posted' or count(l.id)<2
      or coalesce(sum(l.amount) filter(where l.side='debit'),0)<=0
      or coalesce(sum(l.amount) filter(where l.side='debit'),0)
        <>coalesce(sum(l.amount) filter(where l.side='credit'),0)) then
    raise exception 'C4 decimal preflight: incomplete/unbalanced existing journal; do not repair silently';
  end if;
  -- Refuse an unexpected prior schema rather than removing unrelated checks.
  select count(*),min(conname) into matches,constraint_name from pg_constraint
  where conrelid='public.journal_lines'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%trunc(amount)%';
  if matches<>1 then raise exception 'C4 decimal preflight: expected exactly one C2 integral-amount check'; end if;
  execute format('alter table public.journal_lines drop constraint %I',constraint_name);
end $$;
-- Keep unscaled numeric: numeric(p,2) rounds BEFORE CHECK and would accept 0.001.
-- Preserve the existing 20-major-digit limit and add at most two decimal places.
alter table public.journal_lines add constraint journal_lines_syp_major_amount_check
  check(amount>0 and amount<100000000000000000000 and amount=round(amount,2)
    and amount::text not in ('NaN','Infinity','-Infinity')) not valid;
alter table public.journal_lines validate constraint journal_lines_syp_major_amount_check;
-- Posting, balance checks, reversal checks, immutable guards and ACLs unchanged.
-- Existing integers keep their exact major-SYP meaning, even in a nonempty book.
commit;
