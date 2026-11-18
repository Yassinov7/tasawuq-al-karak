-- Owner-only diagnostics for the two reported starts. No writes or business RPC.
-- Optional: privately replace the two NULL UUIDs with exact offer IDs if timestamp matches are ambiguous.
-- No account IDs, names, notification text, tokens or secrets are returned.
begin transaction read only;
select clock_timestamp() server_now,current_setting('TimeZone') server_timezone;

-- 01. Normalized BODY fingerprints of the original local definitions.
-- Compare before applying the proposed repair. Formatting whitespace is ignored.
-- FALSE or a missing function requires deployment review; no function text is returned.
with expected(schema_name,function_name,expected_md5) as (values
 ('notification_private','publish_offer_starts','6bad636df3ef57791ac3a9013667d9b8'),
 ('notification_private','retain_started_offer','c28b798c3fbe44bef8c8e460fe9f6d05'),
 ('public','set_store_offer_notifications','37fe2eb4c20aa78f958a1b2feee95bc3'),
 ('public','save_store_offer_v2','70486a2282251d9d19ab1b4a0991d8a5'),
 ('public','save_store_offer','190b6e65e469694ed0f0f5aaef9328dc')
)
select e.schema_name,e.function_name,p.oid is not null function_exists,
 p.prosecdef security_definer,
 md5(btrim(regexp_replace(p.prosrc,E'\\s+',' ','g'))) live_body_md5,e.expected_md5,
 md5(btrim(regexp_replace(p.prosrc,E'\\s+',' ','g')))=e.expected_md5 matches_original_local_body,
 p.proconfig='{"search_path=\"\""}'::text[] empty_search_path
from expected e left join pg_namespace ns on ns.nspname=e.schema_name
left join pg_proc p on p.pronamespace=ns.oid and p.proname=e.function_name
order by 1,2;

-- 02. Trigger wiring and RLS metadata. No trigger execution or policy source returned.
select c.relname,t.tgname,t.tgenabled,p.proname trigger_function,p.prosecdef
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and t.tgrelid in ('public.store_offers'::regclass,'public.notifications'::regclass)
order by c.relname,t.tgname;
select c.relname,c.relrowsecurity,c.relforcerowsecurity,
 pg_get_userbyid(c.relowner)=pg_get_userbyid(p.proowner) publisher_owns_table,
 r.rolbypassrls publisher_bypasses_rls
from pg_class c join pg_proc p on p.oid='notification_private.publish_offer_starts()'::regprocedure
join pg_roles r on r.oid=p.proowner
where c.oid in ('public.notifications'::regclass,'public.store_offers'::regclass,
 'notification_private.offer_start_events'::regclass);
-- Original event table has ONLY offer_id; no processing timestamp exists.
select column_name,data_type from information_schema.columns
where table_schema='notification_private' and table_name='offer_start_events' order by ordinal_position;

-- 03. Both offers + every CURRENT follower, anonymized within the result.
-- A deleted/recreated follow or toggled preference cannot reconstruct history.
with targets(label,start_value,offer_value) as (values
 ('offer_1','2026-11-18 07:00:00+00'::timestamptz,null::uuid),
 ('offer_2','2026-11-18 06:52:56.568+00'::timestamptz,null::uuid)
), matched as (
 select t.label,o.*,s.status::text store_status,m.status::text merchant_status,
 count(*) over(partition by t.label) matching_offers
 from targets t join public.store_offers o
 on (t.offer_value is not null and o.id=t.offer_value)
 or (t.offer_value is null and o.starts_at=t.start_value)
 join public.stores s on s.id=o.store_id join public.merchants m on m.id=s.merchant_id
)
select o.label,o.matching_offers,o.created_at,o.updated_at,o.starts_at,o.ends_at,o.is_active,
 o.store_status,o.merchant_status,
 exists(select 1 from notification_private.offer_start_events e where e.offer_id=o.id) consumed,
 (o.created_at<=o.starts_at) creation_not_after_start,
 extract(epoch from(o.starts_at-o.created_at)) start_minus_creation_seconds,
 case when f.user_id is not null then row_number() over(partition by o.label,o.id order by f.user_id) end follower_label,
 f.followed_at,p.role current_role,pref.enabled saved_preference,pref.changed_at,
 coalesce(pref.enabled,true) effective_preference,
 (f.followed_at<=o.starts_at) followed_in_time,
 (pref.user_id is null or (pref.enabled and pref.changed_at<=o.starts_at)) preference_in_time,
 (f.user_id is not null and p.role='customer' and f.followed_at<=o.starts_at
   and (pref.user_id is null or (pref.enabled and pref.changed_at<=o.starts_at))) recipient_predicate_now,
 (o.is_active and o.ends_at>clock_timestamp() and o.store_status='accepted' and o.merchant_status='accepted')
   offer_predicate_now,
 -- Count any standard JSON offerId, regardless of event/type; then event_key separately.
 (select count(*) from public.notifications n where n.data->>'offerId'=o.id::text) json_offer_notifications,
 (select count(*) from public.notifications n where n.event_key like 'offer-start:'||o.id::text||':%') event_key_notifications,
 (select count(*) from public.notifications n where n.event_key='offer-start:'||o.id::text||':'||f.user_id::text)
   exact_recipient_key_conflicts,
 (select count(*) from public.notifications n where n.user_id=f.user_id and n.data->>'offerId'=o.id::text)
   owned_json_notifications
from matched o
left join public.store_notification_follows f on f.store_id=o.store_id
left join public.profiles p on p.id=f.user_id
left join public.store_offer_notification_preferences pref on pref.user_id=f.user_id
order by o.label,o.created_at,follower_label;

-- 04. A target with zero rows above was NOT identified; no inference about eligibility.
with targets(label,start_value) as (values
 ('offer_1','2026-11-18 07:00:00+00'::timestamptz),
 ('offer_2','2026-11-18 06:52:56.568+00'::timestamptz)
)
select t.label,count(o.id) matching_offers from targets t
left join public.store_offers o on o.starts_at=t.start_value group by t.label order by t.label;
commit;
