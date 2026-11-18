-- OWNER runs in Supabase SQL Editor. No RPC calls, secrets, tokens, UUIDs or message text in output.
-- Run all statements. Transaction is explicitly READ ONLY.
-- Replace each now()-interval '7 days' / now() pair with the SAME explicit
-- timestamptz bounds, e.g. '2026-11-18 10:00:00+03' / '2026-11-18 12:00:00+03'.
-- Bounds cover notification/queue creation, not actual FCM display time.
begin transaction read only;

-- 01. Server clock and timezone. timestamptz comparisons represent absolute instants.
select clock_timestamp() server_now, current_setting('TimeZone') server_timezone;

-- 02. Global identity invariants. Expected duplicate group counts are ZERO.
-- Unique token and primary installation constraints should exist, including disabled rows.
select enabled,count(*) devices from public.push_devices group by enabled;
select
 (select count(*) from (select token from public.push_devices where enabled
   group by token having count(distinct owner_id)>1) x) active_token_multi_owner_groups,
 (select count(*) from (select installation_id from public.push_devices where enabled
   group by installation_id having count(distinct owner_id)>1) x) active_install_multi_owner_groups;
select c.conname, c.contype, pg_get_constraintdef(c.oid) definition
from pg_constraint c where c.conrelid='public.push_devices'::regclass
and c.contype in ('p','u');
-- Anonymous labels are ordinal, scoped to this result; not reusable account identifiers.
with counts as (
 select owner_id,count(*) filter(where enabled) active_devices,
 count(*) filter(where not enabled) inactive_devices
 from public.push_devices group by owner_id
)
select row_number() over(order by active_devices desc,owner_id) account_label,
 active_devices,inactive_devices from counts order by account_label;

-- 03. Sanity checks on deployed functions. FALSE indicates drift or missing hardening.
-- These are characteristic checks, not proof of byte-identical deployment.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
 md5(pg_get_functiondef(p.oid)) definition_fingerprint,
 case when p.proname='register_push_device' then
   position('delete from public.push_devices where token=token_value' in pg_get_functiondef(p.oid))>0 end removes_other_install_for_same_token,
 case when p.proname='authorize_push_delivery' then
   position('d.owner_id=n.user_id' in pg_get_functiondef(p.oid))>0 end checks_recipient_owner,
 case when p.proname='authorize_push_delivery' then
   position('d.token=q.leased_token' in pg_get_functiondef(p.oid))>0 end checks_leased_token,
 case when p.proname='publish_offer_starts' then
   position('10 minutes' in pg_get_functiondef(p.oid))>0 end has_offer_window
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in
 ('register_push_device','disable_push_device','claim_push_deliveries',
  'authorize_push_delivery','read_push_delivery_message','finish_push_delivery','reconcile_push_deliveries'))
or (n.nspname='notification_private' and p.proname='publish_offer_starts')
order by n.nspname,p.proname;
select has_table_privilege('authenticated','public.push_devices','SELECT') client_reads_devices,
 has_table_privilege('authenticated','public.push_deliveries','SELECT') client_reads_queue;

-- 04. Role routing. owner_mismatch checks CURRENT device ownership, not ownership at send time.
-- A mismatch on sent/ticket can be a legitimate subsequent account switch.
-- A mismatch on pending/leased is a candidate for suppression by claim/authorization.
with period as (select now()-interval '7 days' from_at,now() to_at)
select q.state,p.role recipient_role,d.enabled,
 (n.user_id is distinct from d.owner_id) current_owner_mismatch,
 (q.leased_token is not null and q.leased_token is distinct from d.token) token_changed,
 (n.created_at<d.registered_at) notification_predates_registration,
 (q.ticket is not null) has_ticket,count(*) deliveries,
 min(n.created_at) oldest_notification,max(n.created_at) newest_notification
from public.push_deliveries q join public.notifications n on n.id=q.notification_id
join public.push_devices d on d.installation_id=q.installation_id
left join public.profiles p on p.id=n.user_id cross join period t
where q.created_at>=t.from_at and q.created_at<t.to_at
group by 1,2,3,4,5,6,7 order by 1,2;

-- 05. Focus on the three reported event families, without exposing notification copy or IDs.
-- An invoice_owner_mismatch > 0 is different from a device routing mismatch.
with period as (select now()-interval '7 days' from_at,now() to_at),
events as (
 select n.*,case
 when n.event_key like 'pickup:%' then 'merchant-pickup'
 when i.kind in ('SAL','DLV') then 'invoice-'||i.kind end family,
 i.owner_id invoice_owner
 from public.notifications n left join public.money_invoices i on i.id::text=n.data->>'invoiceId'
)
select e.family,p.role recipient_role,count(distinct e.id) notifications,
 count(distinct e.id) filter(where e.invoice_owner is not null and e.user_id<>e.invoice_owner) invoice_owner_mismatch,
 count(q.id) queue_rows,count(q.id) filter(where q.ticket is not null) with_ticket,
 count(q.id) filter(where q.state='sent') receipt_confirmed,
 count(q.id) filter(where d.owner_id<>e.user_id) current_device_owner_mismatch
from events e left join public.profiles p on p.id=e.user_id
left join public.push_deliveries q on q.notification_id=e.id
left join public.push_devices d on d.installation_id=q.installation_id cross join period t
where e.family is not null and e.created_at>=t.from_at and e.created_at<t.to_at
group by 1,2 order by 1,2;

-- Pickup recipient against the CURRENT store owner. Ownership changes since the
-- event require historical evidence; a nonzero result alone is not a proven writer bug.
select count(*) pickup_notifications,
 count(*) filter(where n.user_id is distinct from m.owner_user_id) current_store_owner_mismatch
from public.notifications n
join public.store_orders so on so.id::text=n.data->>'storeOrderId'
join public.stores s on s.id=so.store_id
join public.merchants m on m.id=s.merchant_id
where n.event_key like 'pickup:%' and n.created_at>=now()-interval '7 days' and n.created_at<now();

-- 06. Anonymous per-delivery timeline, capped at 200 rows.
-- registered_at is the latest ownership/re-enable boundary, updated_at may be only a heartbeat.
-- leased_at_estimate is LAST CURRENT lease only, not the first attempt.
-- There are NO persisted first_attempt_at, ticket_received_at, receipt_received_at,
-- device owner history, or actual FCM delivered_at columns in the local schema.
with period as (select now()-interval '7 days' from_at,now() to_at)
select row_number() over(order by q.created_at,q.id) delivery_label,q.state,q.attempts,
 p.role recipient_role,n.created_at notification_at,q.created_at queued_at,
 d.registered_at current_registration_at,d.updated_at device_last_update,
 q.lease_until-interval '2 minutes' last_active_lease_at_estimate,q.next_attempt,
 extract(epoch from(q.created_at-n.created_at)) enqueue_seconds,
 extract(epoch from((q.lease_until-interval '2 minutes')-q.created_at)) current_lease_wait_seconds,
 (n.created_at<d.registered_at) predates_registration,
 (n.user_id<>d.owner_id) current_owner_mismatch,
 (q.ticket is not null) expo_ticket_present,
 case when q.last_error in ('expired','device_inactive','read_or_device_inactive','NoLongerEligible',
 'DeviceNotRegistered','MessageTooBig','InvalidCredentials','MessageRateExceeded','MismatchSenderId',
 'PushRejected','TransportUnavailable') then q.last_error
 when q.last_error is not null then 'other_redacted' end error_category
from public.push_deliveries q join public.notifications n on n.id=q.notification_id
join public.push_devices d on d.installation_id=q.installation_id
left join public.profiles p on p.id=n.user_id cross join period t
where q.created_at>=t.from_at and q.created_at<t.to_at
order by q.created_at,q.id limit 200;

-- 07. Backlog shared by NEW SENDS and RECEIPT POLLS. Worker claims only 10 per tick.
select state,(ticket is not null) receipt_poll, count(*) queue_rows,
 count(*) filter(where next_attempt<=now() and (lease_until is null or lease_until<now())) due_now,
 min(created_at) oldest_queue_at,min(next_attempt) next_due
from public.push_deliveries where state not in ('sent','dead') group by 1,2 order by 1,2;
select date_trunc('minute',created_at) queued_minute,count(*) queued
from public.push_deliveries where created_at>=now()-interval '7 days'
group by 1 order by 1 desc limit 120;

-- 08. Offer diagnostics. Optional: replace NULL::uuid with ONE real test offer ID.
-- Output uses ordinal labels only. Default examines starts within the incident period
-- plus unbounded legacy offers. A supplied offer ID bypasses that time filter.
-- Current follow/preference state cannot reconstruct historical eligibility after edits.
with params as (
 select null::uuid target_offer,now()-interval '7 days' from_at,now() to_at
), candidates as (
 select o.id,o.starts_at,o.ends_at,o.is_active,s.status::text store_status,m.status::text merchant_status,
 exists(select 1 from notification_private.offer_start_events e where e.offer_id=o.id) consumed,
 (select count(*) from public.store_notification_follows f where f.store_id=o.store_id) followers_now,
 (select count(*) from public.store_notification_follows f
   join public.profiles p on p.id=f.user_id and p.role='customer'
   left join public.store_offer_notification_preferences pref on pref.user_id=f.user_id
   where f.store_id=o.store_id and f.followed_at<=o.starts_at
   and (pref.user_id is null or (pref.enabled and pref.changed_at<=o.starts_at))) eligible_by_current_snapshot,
 (select count(*) from public.store_notification_follows f where f.store_id=o.store_id
   and f.followed_at>o.starts_at) followed_after_start,
 (select count(*) from public.store_notification_follows f
   join public.store_offer_notification_preferences pref on pref.user_id=f.user_id
   where f.store_id=o.store_id and (not pref.enabled or pref.changed_at>o.starts_at)) preference_excluded,
 (select count(*) from public.notifications n where n.data->>'offerId'=o.id::text
   and n.data->>'event'='offer-start') notification_rows,
 (select count(*) from public.push_deliveries q join public.notifications n on n.id=q.notification_id
   where n.data->>'offerId'=o.id::text and n.data->>'event'='offer-start') queue_rows
 from public.store_offers o join public.stores s on s.id=o.store_id
 join public.merchants m on m.id=s.merchant_id cross join params p
 where (p.target_offer is not null and o.id=p.target_offer)
 or (p.target_offer is null and (o.starts_at is null or o.starts_at between p.from_at and p.to_at))
)
select row_number() over(order by starts_at nulls first,id) offer_label,
 starts_at,ends_at,is_active,store_status,merchant_status,consumed,
 followers_now,eligible_by_current_snapshot,followed_after_start,preference_excluded,notification_rows,queue_rows,
 case
 when notification_rows>0 then 'F: exists; investigate client visibility/owner if absent in app'
 when starts_at is null or starts_at>now() then 'A: unbounded legacy or not due'
 when not is_active or ends_at is null or ends_at<=now()
   or store_status<>'accepted' or merchant_status<>'accepted' then 'B: ineligible NOW; history required'
 when not consumed and starts_at<=now()-interval '10 minutes' then 'C: missed 10-minute window'
 when not consumed then 'C: due, not consumed; inspect cron timings'
 when eligible_by_current_snapshot=0 then 'D: consumed, no eligible followers in current snapshot'
 else 'E: consumed, eligible NOW, no surviving notification; historical evidence required' end finding
from candidates order by starts_at nulls first,id limit 100;

-- 08b. OPTIONAL exact client + offer investigation. Enter IDs privately here, never
-- share those inputs. NULL means no selection; output contains booleans/counts only.
with params as (select null::uuid customer_value,null::uuid offer_value)
select (p.customer_value is not null and p.offer_value is not null) target_selected,
 (select role='customer' from public.profiles where id=p.customer_value) is_customer,
 (f.user_id is not null) follows_now,(f.followed_at<=o.starts_at) followed_before_start,
 coalesce(pref.enabled,true) marketing_enabled_now,
 (pref.user_id is null or pref.changed_at<=o.starts_at) preference_before_start,
 (select count(*) from public.notifications n where n.user_id=p.customer_value
   and n.data->>'offerId'=p.offer_value::text and n.data->>'event'='offer-start') owned_notifications,
 (select count(*) from public.push_devices d where d.owner_id=p.customer_value and d.enabled) active_devices
from params p left join public.store_offers o on o.id=p.offer_value
left join public.store_notification_follows f on f.store_id=o.store_id and f.user_id=p.customer_value
left join public.store_offer_notification_preferences pref on pref.user_id=p.customer_value;

-- 09. Schedules and their run outcomes. No commands/HTTP payloads/error bodies.
-- Requires pg_cron already installed (confirmed by owner).
select jobid,jobname,schedule,active from cron.job order by jobid;
select j.jobname,r.status,r.start_time,r.end_time,
 extract(epoch from(r.end_time-r.start_time)) duration_seconds
from cron.job_run_details r join cron.job j on j.jobid=r.jobid
where j.jobname in ('tasawuq-push-dispatch','tasawuq-offer-starts')
and r.start_time>=now()-interval '7 days' order by r.start_time desc limit 100;
commit;
