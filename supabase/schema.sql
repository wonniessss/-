-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists signups_email_unique on public.signups (lower(email));
create index if not exists signups_created_at_idx on public.signups (created_at desc);

alter table public.signups enable row level security;

-- 서버(API)의 service_role 키로만 insert 합니다. anon 키로는 직접 접근 불가.
