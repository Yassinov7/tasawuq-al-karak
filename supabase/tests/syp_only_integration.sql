-- MANUAL: isolated development database only, after 20261026000100.
-- psql -v ON_ERROR_STOP=1 -v admin_user=... -v customer_user=... -v driver_user=...
--      -v store_id=... -v other_store_id=... -f supabase/tests/syp_only_integration.sql
-- Fixtures: two accepted stores with current subscriptions (commission >0 and <100),
-- accepted driver and customer/admin profiles. Customer cart must initially be empty.
-- All writes roll back. Auth/Storage/reference data are never deleted or relabelled.
\set ON_ERROR_STOP on
begin;
select set_config('test.admin', :'admin_user', true), set_config('test.customer', :'customer_user', true),
 set_config('test.driver', :'driver_user', true), set_config('test.store', :'store_id', true),
 set_config('test.other_store', :'other_store_id', true);
create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERT: %',message; end if; end; $$;
do $$
declare
 admin_id uuid:=current_setting('test.admin')::uuid; customer_id uuid:=current_setting('test.customer')::uuid;
 driver_id_value uuid:=current_setting('test.driver')::uuid; store_id_value uuid:=current_setting('test.store')::uuid;
 other_store uuid:=current_setting('test.other_store')::uuid; owner_id uuid; other_owner uuid; merchant uuid;
 category uuid; zone uuid; fee numeric; product uuid; other_product uuid; offer uuid; cart uuid;
 parent_order uuid; child uuid; other_child uuid; commission public.store_order_commissions%rowtype;
 entitlement uuid; entitlement_amount numeric; batch uuid; inclusion uuid; payment uuid; reversal uuid;
 invoice uuid:=gen_random_uuid(); subscription uuid; remittance uuid; operation_key uuid:=gen_random_uuid(); baseline_remaining numeric;
 report jsonb; failed boolean;
begin
 perform pg_temp.assert(store_id_value<>other_store,'two distinct stores required');
 select m.owner_user_id,s.merchant_id into owner_id,merchant from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=store_id_value and s.status='accepted';
 select m.owner_user_id into other_owner from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=other_store and s.status='accepted';
 perform pg_temp.assert(owner_id is not null and other_owner is not null,'accepted store fixtures');
 perform pg_temp.assert(exists(select 1 from public.profiles where id=customer_id and role='customer'),'customer fixture');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform pg_temp.assert(public.is_admin(),'admin fixture');
 select id into category from public.product_categories where is_active limit 1;
 select id,fixed_fee into zone,fee from public.delivery_zones where is_active limit 1;
 perform pg_temp.assert(category is not null and zone is not null,'reference fixtures');
 insert into public.products(store_id,category_id,title,description,price,selling_unit)
 values(store_id_value,category,'SYP integration product','test',100000,'unit') returning id into product;
 insert into public.products(store_id,category_id,title,description,price,selling_unit)
 values(other_store,category,'SYP rejected product','test',40000,'unit') returning id into other_product;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 offer:=public.save_store_offer(null,'SYP offer','test','discount','percentage',10,null,null,true,
   jsonb_build_array(jsonb_build_object('product_id',product,'item_role','discounted','quantity',1)));
 perform pg_temp.assert(offer is not null,'new currency-free offer RPC');
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 perform pg_temp.assert(not exists(select 1 from public.customer_cart_items ci join public.customer_carts c on c.id=ci.cart_id where c.customer_id=customer_id),'empty fixture cart required');
 perform pg_temp.assert(not exists(select 1 from public.customer_cart_offer_selections os join public.customer_carts c on c.id=os.cart_id where c.customer_id=customer_id),'empty fixture offers required');
 insert into public.customer_carts(customer_id) values(customer_id) on conflict(customer_id) do update set updated_at=now() returning id into cart;
 perform public.add_customer_cart_offer(offer);
 perform public.remove_customer_cart_offer(offer);
 insert into public.customer_cart_items(cart_id,product_id,quantity) values(cart,product,1),(cart,other_product,1);
 parent_order:=public.create_order_from_cart('Test customer','0999999999','Integration address',zone,'');
 execute 'set constraints all immediate';
 perform pg_temp.assert((select count(*)=1 and max(total)=140000+fee and max(delivery_fee)=fee from public.customer_order_totals where customer_order_id=parent_order),'one total and one delivery fee');
 select id into child from public.store_orders where customer_order_id=parent_order and store_id=store_id_value;
 select id into other_child from public.store_orders where customer_order_id=parent_order and store_id=other_store;
 perform set_config('request.jwt.claim.sub',other_owner::text,true);
 perform public.update_store_order_status(other_child,'rejected','integration test');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.update_store_order_status(child,'preparing');
 perform public.update_store_order_status(child,'ready_for_pickup');
 perform set_config('request.jwt.claim.sub',driver_id_value::text,true);
 perform public.set_driver_availability(true);
 perform public.accept_delivery_task(parent_order);
 perform public.update_delivery_task_status(parent_order,'picked_up');
 perform public.update_delivery_task_status(parent_order,'delivered');
 perform pg_temp.assert((select count(*)=1 and max(collectible_amount)=100000+fee from public.customer_order_cash_obligations where customer_order_id=parent_order),'rejected child excluded from cash');
 perform pg_temp.assert((select count(*)=1 and max(delivery_fee_amount)=fee from public.driver_delivery_fee_entitlements where customer_order_id=parent_order),'driver fee once');
 perform pg_temp.assert(not exists(select 1 from public.merchant_order_entitlements where store_order_id=other_child),'no entitlement for rejected child');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.create_delivered_order_cash_foundations(parent_order);
 perform public.create_delivered_order_cash_foundations(parent_order);
 perform pg_temp.assert((select count(*)=1 from public.customer_order_cash_obligations where customer_order_id=parent_order),'delivery idempotency');
 select * into commission from public.store_order_commissions where store_order_id=child;
 perform pg_temp.assert(commission.status='due' and commission.base_amount=100000 and commission.commission_amount=round(100000*commission.commission_rate/100,2),'commission snapshot and rounding');
 perform pg_temp.assert(commission.commission_amount>0 and commission.commission_amount<100000,'nonzero commission fixture');
 reversal:=public.reverse_store_order_commission(commission.id,1,operation_key,'integration reversal');
 perform pg_temp.assert(public.reverse_store_order_commission(commission.id,1,operation_key,'integration reversal')=reversal,'reversal idempotency');
 perform pg_temp.assert((select commission_amount=commission.commission_amount from public.store_order_commissions where id=commission.id),'original commission immutable');
 select merchant_order_entitlement_id,current_entitlement_amount into entitlement,entitlement_amount from public.merchant_order_entitlement_positions where store_order_id=child;
 perform pg_temp.assert(entitlement_amount=100000-commission.commission_amount+1,'reversal appended to entitlement');
 batch:=public.create_merchant_settlement_batch(merchant,array[entitlement],gen_random_uuid());
 select id into inclusion from public.merchant_settlement_batch_entitlements where batch_id=batch;
 operation_key:=gen_random_uuid();
 payment:=public.record_merchant_settlement_payment(batch,1,jsonb_build_array(jsonb_build_object('batch_entitlement_id',inclusion,'amount',1)),operation_key);
 perform pg_temp.assert(public.record_merchant_settlement_payment(batch,1,jsonb_build_array(jsonb_build_object('batch_entitlement_id',inclusion,'amount',1)),operation_key)=payment,'settlement idempotency');
 perform pg_temp.assert((select status='open' from public.merchant_settlement_batches where id=batch),'partial stays open');
 perform public.record_merchant_settlement_payment(batch,entitlement_amount-1,jsonb_build_array(jsonb_build_object('batch_entitlement_id',inclusion,'amount',entitlement_amount-1)),gen_random_uuid());
 perform pg_temp.assert((select status='completed' from public.merchant_settlement_batches where id=batch),'fully paid completes');
 select coalesce(custody_remaining_amount,0) into baseline_remaining from public.driver_cash_custody_positions where driver_id=driver_id_value;
 operation_key:=gen_random_uuid();
 remittance:=public.record_driver_cash_remittance(driver_id_value,baseline_remaining+50,operation_key);
 perform pg_temp.assert(public.record_driver_cash_remittance(driver_id_value,baseline_remaining+50,operation_key)=remittance,'remittance idempotency');
 perform pg_temp.assert((select driver_credit_amount>=50 from public.driver_cash_custody_positions where driver_id=driver_id_value),'surplus is driver credit');
 failed:=false;
 begin perform public.pay_driver_cash_credit(driver_id_value,1e14,gen_random_uuid()); exception when raise_exception then failed:=true; end;
 perform pg_temp.assert(failed,'payout exceeds credit rejected');
 perform public.pay_driver_cash_credit(driver_id_value,20,gen_random_uuid());
 operation_key:=gen_random_uuid();
 subscription:=public.renew_merchant_subscription(merchant,operation_key,'SYP integration renewal');
 perform pg_temp.assert(public.renew_merchant_subscription(merchant,operation_key,'SYP integration renewal')=subscription,'renewal idempotency');
 perform pg_temp.assert((select count(*)=1 from public.subscription_invoices where subscription_id=subscription and kind='renewal' and currency='SYP'),'renewal creates one SYP invoice');
 select id into subscription from public.merchant_subscriptions where merchant_id=merchant order by starts_at desc limit 1;
 insert into public.subscription_invoices(id,invoice_number,merchant_id,subscription_id,kind,total_amount,status,idempotency_key)
 values(invoice,'SYP-test-'||invoice::text,merchant,subscription,'adjustment',100,'open',gen_random_uuid());
 insert into public.merchant_ledger_entries(merchant_id,effect,source_type,source_id,amount)
 values(merchant,'increase_exposure','subscription_invoice',invoice,100);
 operation_key:=gen_random_uuid();
 payment:=public.record_subscription_payment(merchant,40,'cash',operation_key,jsonb_build_array(jsonb_build_object('invoice_id',invoice,'amount',40)));
 perform pg_temp.assert(public.record_subscription_payment(merchant,40,'cash',operation_key,jsonb_build_array(jsonb_build_object('invoice_id',invoice,'amount',40)))=payment,'subscription payment idempotency');
 perform pg_temp.assert((select status='partially_paid' from public.subscription_invoices where id=invoice),'partial subscription invoice');
 perform public.record_subscription_payment(merchant,60,'cash',gen_random_uuid(),jsonb_build_array(jsonb_build_object('invoice_id',invoice,'amount',60)));
 perform pg_temp.assert((select status='paid' from public.subscription_invoices where id=invoice),'paid subscription invoice');
 perform public.set_merchant_credit_limit(merchant,true,1000,'integration');
 report:=public.admin_financial_report('cash');
 perform pg_temp.assert(jsonb_typeof(report->'summary')='array','cash report');
 report:=public.admin_sales_revenue_report('merchant');
 perform pg_temp.assert(jsonb_typeof(report->'rows')='array','merchant report');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 report:=public.merchant_financial_account();
 perform pg_temp.assert(jsonb_array_length(report->'summary')<=1,'single-unit merchant summary');
end; $$;
rollback;
