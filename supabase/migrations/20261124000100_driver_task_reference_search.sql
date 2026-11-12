-- Search assigned tasks by their server-issued TSK reference before pagination.
create function public.search_driver_task_references(
  search_value text,
  view_value text,
  page_offset integer,
  page_size integer
) returns table (task_id uuid, reference text)
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  term text := upper(translate(trim(coalesce(search_value, '')),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'));
begin
  if actor is null or not public.is_approved_driver() then
    raise exception 'driver access denied' using errcode = '42501';
  end if;
  if view_value is null or view_value not in ('active', 'completed')
    or page_offset is null or page_offset < 0
    or page_size is null or page_size not between 1 and 50 then
    raise exception 'invalid task page' using errcode = '22023';
  end if;
  if term = '' or length(term) > 40 then return; end if;

  return query
  select t.id, r.reference
  from public.delivery_tasks t
  join public.commerce_references r on r.kind = 'TSK' and r.record_id = t.id
  where t.driver_id = actor
    and ((view_value = 'active' and t.status in ('accepted', 'picked_up'))
      or (view_value = 'completed' and t.status = 'delivered'))
    and position(term in r.reference) > 0
  order by
    case when view_value = 'active' then t.status end desc nulls last,
    case when view_value = 'active' then t.accepted_at end asc nulls last,
    case when view_value = 'completed' then t.delivered_at else t.created_at end desc nulls last,
    t.id desc
  limit (page_size + 1) offset page_offset;
end;
$$;

revoke all on function public.search_driver_task_references(text, text, integer, integer) from public, anon;
grant execute on function public.search_driver_task_references(text, text, integer, integer) to authenticated;
notify pgrst, 'reload schema';
