begin;

-- Keep existing UUIDs and FK targets compatible with deployed clients and signup RPCs.
lock table public.store_categories, public.product_categories in share row exclusive mode;
create schema category_private;
revoke all on schema category_private from public, anon, authenticated;

create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('store','product')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  parent_id uuid,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, slug),
  unique (scope, name),
  unique (scope, id),
  check (parent_id is distinct from id),
  foreign key (scope, parent_id) references public.catalog_categories(scope, id) on delete restrict
);
create index catalog_categories_tree_idx on public.catalog_categories(scope, parent_id, sort_order, id);

-- Copy deployed categories verbatim, including disabled and locally added rows.
insert into public.catalog_categories(id, scope, name, slug, sort_order, is_active, created_at)
select id, 'store', name, slug, sort_order, is_active, created_at from public.store_categories
union all
select id, 'product', name, slug, sort_order, is_active, created_at from public.product_categories;

-- Serialize tree changes even when two administrators edit different rows concurrently.
create table category_private.tree_guard (scope text primary key, revision bigint not null default 0);
insert into category_private.tree_guard(scope) values ('store'), ('product');

create function category_private.validate_tree() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.scope <> old.scope or new.id <> old.id) then
    raise exception 'category identity is immutable' using errcode = '23514';
  end if;
  update category_private.tree_guard set revision = revision + 1
  where scope = case when tg_op = 'DELETE' then old.scope else new.scope end;
  if tg_op = 'DELETE' then return old; end if;
  if new.parent_id is not null and (
    new.parent_id = new.id
    or not exists(select 1 from public.catalog_categories p
      where p.id = new.parent_id and p.scope = new.scope and p.parent_id is null)
    or exists(select 1 from public.catalog_categories c where c.parent_id = new.id)
  ) then
    raise exception 'category parent must be a root in the same scope; only two levels are allowed' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger catalog_categories_validate before insert or update or delete on public.catalog_categories
for each row execute function category_private.validate_tree();

-- Legacy tables become read-compatible mirrors. Existing FKs reject removal of any
-- category used by a product, store or application and abort the whole transaction.
create function category_private.sync_legacy() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target_table text;
begin
  target_table := case when (case when tg_op = 'DELETE' then old.scope else new.scope end) = 'store'
    then 'store_categories' else 'product_categories' end;
  if tg_op = 'DELETE' then
    execute format('delete from public.%I where id = $1', target_table) using old.id;
    return old;
  end if;
  execute format(
    'insert into public.%1$I as mirror (id,name,slug,sort_order,is_active,created_at)
     select c.id,c.name,c.slug,c.sort_order,c.is_active and coalesce(p.is_active,true),c.created_at
     from public.catalog_categories c left join public.catalog_categories p on p.id = c.parent_id
     where c.id = $1 or c.parent_id = $1
     on conflict (id) do update set name=excluded.name, slug=excluded.slug,
       sort_order=excluded.sort_order, is_active=excluded.is_active
     where (mirror.name, mirror.slug, mirror.sort_order, mirror.is_active)
       is distinct from (excluded.name, excluded.slug, excluded.sort_order, excluded.is_active)',
    target_table) using new.id;
  return new;
end;
$$;
create trigger catalog_categories_legacy after insert or update or delete on public.catalog_categories
for each row execute function category_private.sync_legacy();

-- Seed the mock catalog's labels under known roots. Reuse an existing name or slug.
with seeds(slug,name,parent_slug,product_scope) as (values
  ('supermarkets','سوبرماركت','groceries',false), ('vegetables','خضار وفواكه','groceries',true),
  ('meat','ملاحم','groceries',false), ('roastery','محامص','groceries',false),
  ('bakery','مخابز','groceries',false), ('coffee','قهوة ومشروبات','drinks',true),
  ('juice','عصائر وحلويات','drinks',true), ('restaurants','مطاعم','groceries',false),
  ('pharmacy','صيدليات','personal-care',false), ('cosmetics','عناية وتجميل','personal-care',true),
  ('perfume','عطور','personal-care',true), ('clothing','ألبسة',null,true),
  ('shoes','أحذية',null,true), ('electronics','إلكترونيات',null,true),
  ('home','منزل وأدوات','home-kitchen',true), ('hardware','عدد وأدوات','home-kitchen',true),
  ('stationery','قرطاسية',null,true), ('books','كتب',null,true),
  ('flowers','ورد وهدايا',null,true), ('mobile','موبايلات',null,true),
  ('auto','سيارات',null,true), ('laundry','مغاسل',null,false),
  ('pets','مستلزمات الحيوانات',null,true), ('baby','أطفال وأمومة',null,true)
)
insert into public.catalog_categories(id,scope,name,slug,parent_id,sort_order)
select md5('tasawuq:catalog-category:' || s.scope || ':' || v.slug)::uuid,
  s.scope,v.name,v.slug,p.id,100
from seeds v cross join (values ('store'), ('product')) s(scope)
left join public.catalog_categories p on p.scope=s.scope and p.slug=v.parent_slug and p.is_active and p.parent_id is null
where (s.scope='store' or v.product_scope)
  and not exists (select 1 from public.catalog_categories e where e.scope=s.scope and (e.name=v.name or e.slug=v.slug))
on conflict (scope, slug) do nothing;

create function category_private.check_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare expected_scope text := tg_argv[0];
begin
  if tg_op = 'UPDATE' and new.category_id is not distinct from old.category_id then return new; end if;
  perform 1 from category_private.tree_guard where scope = expected_scope for share;
  if not exists (
    select 1 from public.catalog_categories c
    left join public.catalog_categories p on p.id=c.parent_id
    where c.id=new.category_id and c.scope=expected_scope
      and c.is_active and coalesce(p.is_active,true)
  ) then
    raise exception 'category unavailable for this assignment' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger product_category_assignment before insert or update of category_id on public.products
for each row execute function category_private.check_assignment('product');
create trigger store_category_assignment before insert or update of category_id on public.stores
for each row execute function category_private.check_assignment('store');
create trigger merchant_application_category_assignment before insert or update of category_id on public.merchant_applications
for each row execute function category_private.check_assignment('store');

-- Existing mirror policies already encode effective activation, including the parent.
-- Central public reads use the mirrored state; the owner policy preserves disabled names.
alter table public.catalog_categories enable row level security;
create policy catalog_categories_read_active on public.catalog_categories for select to anon, authenticated
using (
  (scope='store' and exists(select 1 from public.store_categories c where c.id=catalog_categories.id and c.is_active))
  or (scope='product' and exists(select 1 from public.product_categories c where c.id=catalog_categories.id and c.is_active))
);
create policy catalog_categories_read_owned on public.catalog_categories for select to authenticated
using (
  exists(select 1 from public.merchant_applications a where a.user_id=auth.uid() and a.category_id=catalog_categories.id)
  or exists(select 1 from public.stores s join public.merchants m on m.id=s.merchant_id
    where m.owner_user_id=auth.uid() and s.category_id=catalog_categories.id)
  or exists(select 1 from public.products p join public.stores s on s.id=p.store_id
    join public.merchants m on m.id=s.merchant_id
    where m.owner_user_id=auth.uid() and p.category_id=catalog_categories.id)
);
create policy catalog_categories_admin on public.catalog_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.catalog_categories from public, anon, authenticated;
grant select on public.catalog_categories to anon, authenticated;
grant insert, update, delete on public.catalog_categories to authenticated;
revoke insert, update, delete, truncate on public.store_categories, public.product_categories from public, anon, authenticated;
revoke all on all functions in schema category_private from public, anon, authenticated;

do $$
begin
  if exists (select 1 from public.stores s left join public.catalog_categories c on c.scope='store' and c.id=s.category_id where c.id is null)
    or exists (select 1 from public.merchant_applications a left join public.catalog_categories c on c.scope='store' and c.id=a.category_id where c.id is null)
    or exists (select 1 from public.products p left join public.catalog_categories c on c.scope='product' and c.id=p.category_id where c.id is null) then
    raise exception 'catalog category backfill has unmapped references';
  end if;
end;
$$;

commit;
