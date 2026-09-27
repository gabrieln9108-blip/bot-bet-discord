-- PRIMEIRO EMPREGO — schema completo para colar no Supabase SQL Editor
--
-- Este arquivo é SQL executável, não um arquivo de credenciais.
-- O projeto do Supabase/database já precisa existir: o SQL Editor não cria
-- um projeto novo. Execute este arquivo uma vez no projeto correto.
--
-- O backend desta entrega ainda mantém os registros do produto em memória
-- para preservar o comportamento atual. Estas tabelas são a base persistente
-- segura para a próxima etapa de integração do backend.
--
-- Dados enviados pelo usuário ficam em jsonb/text e devem continuar sendo
-- tratados como dados não confiáveis. Nunca execute conteúdo dessas colunas.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default '',
  purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text not null default '',
  template text not null,
  status text not null default 'pronto',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculums_status_check check (status in ('rascunho', 'pronto')),
  constraint curriculums_data_object_check check (jsonb_typeof(data) = 'object')
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  type text not null,
  status text not null default 'active',
  question text not null default '',
  question_number integer not null default 1,
  total_questions integer not null default 0,
  response_mode text not null default 'text',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviews_status_check check (status in ('active', 'completed')),
  constraint interviews_response_mode_check check (response_mode in ('text', 'voice')),
  constraint interviews_question_number_check check (question_number > 0),
  constraint interviews_total_questions_check check (total_questions >= 0)
);

create table if not exists public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  question_number integer not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  constraint interview_messages_question_number_check check (question_number > 0)
);

create table if not exists public.job_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null default '',
  company text not null default '',
  location text not null default '',
  salary text not null default '',
  education text not null default '',
  experience text not null default '',
  requirements text[] not null default '{}',
  responsibilities text[] not null default '{}',
  skills text[] not null default '{}',
  benefits text[] not null default '{}',
  fit integer not null default 0,
  compatibility_label text not null default '',
  score_breakdown jsonb not null default '{}'::jsonb,
  strengths text[] not null default '{}',
  partial text[] not null default '{}',
  not_found text[] not null default '{}',
  recommendations text[] not null default '{}',
  attention_signals text[] not null default '{}',
  limitations text[] not null default '{}',
  profile_sources text[] not null default '{}',
  gaps text[] not null default '{}',
  summary text not null default '',
  created_at timestamptz not null default now(),
  constraint job_analyses_fit_check check (fit between 0 and 100),
  constraint job_analyses_score_breakdown_object_check
    check (jsonb_typeof(score_breakdown) = 'object')
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  location text not null default '',
  status text not null default 'quero_me_candidatar',
  applied_at date not null,
  job_url text not null default '',
  salary text not null default '',
  notes text not null default '',
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_status_check check (
    status in (
      'quero_me_candidatar', 'enviada', 'aguardando', 'entrevista',
      'segunda_etapa', 'aprovado', 'rejeitado', 'encerrada'
    )
  )
);

-- Checkout initiated before the user has an authenticated Supabase account.
create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  status text not null default 'pending',
  provider text not null default 'kiwify',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint checkout_sessions_status_check check (
    status in ('pending', 'paid', 'cancelled', 'expired')
  )
);

-- Idempotency/replay protection for payment webhooks.
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  transaction_id text not null,
  buyer_id text not null,
  customer_email text not null,
  product_id text,
  product_name text,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  constraint payment_webhook_amount_check check (amount_cents >= 0),
  constraint payment_webhook_payload_object_check check (jsonb_typeof(payload) = 'object')
);

-- Persisted sessions store only a hash of the bearer token, never the token.
create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Security/audit trail. Do not write passwords, tokens, API keys or raw bodies.
create table if not exists public.security_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_audit_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

-- Metadata for future private uploads. The actual file must live in a private
-- storage bucket under a random storage_path, never under original_name.
create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint uploaded_files_size_check check (size_bytes > 0 and size_bytes <= 5242880)
);

create index if not exists curriculums_owner_updated_idx
  on public.curriculums(owner_id, updated_at desc);
create index if not exists interviews_owner_started_idx
  on public.interviews(owner_id, started_at desc);
create index if not exists interview_messages_interview_created_idx
  on public.interview_messages(interview_id, created_at);
create index if not exists job_analyses_owner_created_idx
  on public.job_analyses(owner_id, created_at desc);
create index if not exists applications_owner_applied_idx
  on public.applications(owner_id, applied_at desc);
create index if not exists checkout_sessions_email_created_idx
  on public.checkout_sessions(email, created_at desc);
create index if not exists payment_webhook_processed_idx
  on public.payment_webhook_events(processed_at desc);
create index if not exists security_audit_events_created_idx
  on public.security_audit_events(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists curriculums_set_updated_at on public.curriculums;
create trigger curriculums_set_updated_at
before update on public.curriculums
for each row execute function public.set_updated_at();

drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
before update on public.interviews
for each row execute function public.set_updated_at();

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.curriculums enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_messages enable row level security;
alter table public.job_analyses enable row level security;
alter table public.applications enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.app_sessions enable row level security;
alter table public.security_audit_events enable row level security;
alter table public.uploaded_files enable row level security;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles
for select to authenticated using (id = auth.uid());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists curriculums_owner_all on public.curriculums;
create policy curriculums_owner_all on public.curriculums
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists interviews_owner_all on public.interviews;
create policy interviews_owner_all on public.interviews
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists interview_messages_owner_all on public.interview_messages;
create policy interview_messages_owner_all on public.interview_messages
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists job_analyses_owner_all on public.job_analyses;
create policy job_analyses_owner_all on public.job_analyses
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists applications_owner_all on public.applications;
create policy applications_owner_all on public.applications
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists uploaded_files_owner_all on public.uploaded_files;
create policy uploaded_files_owner_all on public.uploaded_files
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- No client policy is created for checkout_sessions, payment_webhook_events,
-- app_sessions or security_audit_events. They are backend/service-role only.

-- Optional private bucket for future PDF/profile uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'primeiro-emprego-private',
  'primeiro-emprego-private',
  false,
  5242880,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists private_uploads_owner_read on storage.objects;
create policy private_uploads_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'primeiro-emprego-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists private_uploads_owner_insert on storage.objects;
create policy private_uploads_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'primeiro-emprego-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists private_uploads_owner_delete on storage.objects;
create policy private_uploads_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'primeiro-emprego-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);