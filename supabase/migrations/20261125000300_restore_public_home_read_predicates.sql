-- Requires store branding, invoice cutover, and customer home discovery.
-- Restore execution of the boolean predicates already used by anon SELECT RLS.
-- Existing predicates still reject ineligible stores, drafts and changed objects.
begin;
grant execute on function public.store_accepts_new_orders(uuid) to anon;
grant execute on function public.branding_asset_readable(uuid) to anon;
grant execute on function public.branding_read_allowed(text,text) to anon;
commit;
