-- SAFAR SHERZAD Supabase setup
-- Run in Supabase Dashboard > SQL Editor as project owner.
-- IMPORTANT: Create the admin user in Authentication > Users first, using:
-- safarsherzad820@gmail.com. Never place your password in this file.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 140),
  price numeric(12,2) not null default 0 check (price >= 0),
  category text not null default 'گشتی',
  description text not null default '',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  product_name text not null,
  unit_price numeric(12,2) not null default 0,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  note text not null default '',
  status text not null default 'new' check (status in ('new','confirmed','shipped','completed','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;

-- Public visitors can see active products only.
drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products"
on public.products for select
to anon, authenticated
using (is_active = true or (auth.jwt()->>'email' = 'safarsherzad820@gmail.com'));

-- Only the specific admin email can insert/update/delete products.
drop policy if exists "Admin can insert products" on public.products;
create policy "Admin can insert products" on public.products for insert
to authenticated
with check (auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

drop policy if exists "Admin can update products" on public.products;
create policy "Admin can update products" on public.products for update
to authenticated
using (auth.jwt()->>'email' = 'safarsherzad820@gmail.com')
with check (auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

drop policy if exists "Admin can delete products" on public.products;
create policy "Admin can delete products" on public.products for delete
to authenticated
using (auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

-- Customer order rows can be submitted by visitors; admin alone can read them.
drop policy if exists "Visitors can submit orders" on public.orders;
create policy "Visitors can submit orders" on public.orders for insert
to anon, authenticated
with check (
  char_length(customer_name) between 1 and 100
  and char_length(customer_phone) between 5 and 30
  and char_length(customer_address) between 1 and 400
);

drop policy if exists "Admin can read orders" on public.orders;
create policy "Admin can read orders" on public.orders for select
to authenticated
using (auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

drop policy if exists "Admin can update orders" on public.orders;
create policy "Admin can update orders" on public.orders for update
to authenticated
using (auth.jwt()->>'email' = 'safarsherzad820@gmail.com')
with check (auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

-- Product image storage bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images" on storage.objects for select
to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "Admin can upload product images" on storage.objects;
create policy "Admin can upload product images" on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

drop policy if exists "Admin can update product images" on storage.objects;
create policy "Admin can update product images" on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and auth.jwt()->>'email' = 'safarsherzad820@gmail.com')
with check (bucket_id = 'product-images' and auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

drop policy if exists "Admin can delete product images" on storage.objects;
create policy "Admin can delete product images" on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and auth.jwt()->>'email' = 'safarsherzad820@gmail.com');

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update on public.orders to anon, authenticated;


-- Enable live product updates on customer pages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
exception
  when undefined_object then
    raise notice 'Enable Realtime for public.products in the Supabase dashboard.';
end $$;
