
-- Allow customers and guests to read approved stores only.
drop policy if exists stores_read_accepted_public
on public.stores;

create policy stores_read_accepted_public
on public.stores
for select
to anon, authenticated
using (status = 'accepted');

grant select on public.stores to anon, authenticated;
