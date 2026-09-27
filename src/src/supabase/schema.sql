-- Joseph Agency sales dashboard — Supabase schema
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists stock (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  quantity integer not null default 0,
  price numeric(10,2) not null default 0,
  reorder_at integer not null default 5,
  updated_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null,
  item_id uuid references stock(id) on delete set null,
  item_name text not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  total numeric(10,2) not null,
  sold_at timestamptz not null default now()
);

alter table customers enable row level security;
alter table stock enable row level security;
alter table sales enable row level security;

create policy "customers_read" on customers for select using (auth.role() = 'authenticated');
create policy "customers_write" on customers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "stock_read" on stock for select using (auth.role() = 'authenticated');
create policy "stock_write" on stock for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "sales_read" on sales for select using (auth.role() = 'authenticated');
create policy "sales_write" on sales for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
