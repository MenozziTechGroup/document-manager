-- v0.1.13: Document ID Registry (replaces the hand-maintained lists in IDX-IT-001).
-- Run in the Supabase SQL editor BEFORE installing v0.1.13. Safe to re-run.
--
--   doc_types        type codes (SOP, RBK, …) and the DocCenter folder each lives in
--   doc_domains      domain codes (MDM, M365, …); retired codes stay with active = false
--   doc_ids          the ledger: every Doc ID ever issued. Rows are never deleted except
--                    a Reserved ID that was never used, so a retired number can't come back
--   registry_issues  open decisions that need a person (reclassifications, gaps, …)
--   registry_folders the SharePoint folder map printed in IDX-IT-001
--   doc_series       view: issued numbers and next available ID per TYPE-DOMAIN series
--   allocate_doc_id  reserves the next ID in a series atomically

create table if not exists public.doc_types (
  code       text primary key check (code ~ '^[A-Z]{2,4}$'),
  name       text not null default '',
  use        text not null default '',
  folder     text not null default '',
  active     boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.doc_domains (
  code       text primary key check (code ~ '^[A-Z0-9]{2,5}$'),
  name       text not null default '',
  note       text not null default '',
  active     boolean not null default true,
  sort_order integer not null default 0,
  added_at   timestamptz not null default now(),
  added_by   text not null default ''
);

create table if not exists public.doc_ids (
  doc_id        text primary key check (doc_id ~ '^[A-Z]{2,4}-[A-Z0-9]{2,5}-[0-9]{3}$'),
  type_code     text not null references public.doc_types(code) on update cascade,
  domain_code   text not null references public.doc_domains(code) on update cascade,
  seq           integer not null check (seq between 1 and 999),
  title         text not null default '',
  -- Reserved | Draft | Filed | Outside | Unlocated | Tool | Retired
  status        text not null default 'Reserved',
  notes         text not null default '',
  issued_at     timestamptz not null default now(),
  issued_by     text not null default '',
  retired_at    date,
  replaced_by   text not null default '',
  retire_reason text not null default '',
  unique (type_code, domain_code, seq)
);
create index if not exists doc_ids_status_idx on public.doc_ids(status);

create table if not exists public.registry_issues (
  id                  uuid primary key default gen_random_uuid(),
  issue               text not null,
  detail              text not null default '',
  proposed_resolution text not null default '',
  status              text not null default 'open', -- open | resolved
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  resolution          text not null default ''
);

create table if not exists public.registry_folders (
  path       text primary key,
  contents   text not null default '',
  source     text not null default '',
  sort_order integer not null default 0
);

-- Series register. Retired numbers count as issued, so they are never handed out
-- again; a series whose domain or type is retired gets no next number.
create or replace view public.doc_series with (security_invoker = true) as
select
  i.type_code,
  i.domain_code,
  i.type_code || '-' || i.domain_code as series,
  array_agg(i.seq order by i.seq) as issued,
  case when t.active and d.active
       then i.type_code || '-' || i.domain_code || '-' || lpad((max(i.seq) + 1)::text, 3, '0')
  end as next_available
from public.doc_ids i
join public.doc_types t on t.code = i.type_code
join public.doc_domains d on d.code = i.domain_code
group by i.type_code, i.domain_code, t.active, d.active;

-- Reserve the next Doc ID in a series. The advisory lock serialises two techs
-- asking for the same series at the same moment.
create or replace function public.allocate_doc_id(p_type text, p_domain text, p_title text default '')
returns text
language plpgsql
security invoker
as $$
declare
  v_next integer;
  v_id   text;
begin
  if not exists (select 1 from public.doc_types where code = p_type and active) then
    raise exception 'Type code % is not registered or is retired', p_type;
  end if;
  if not exists (select 1 from public.doc_domains where code = p_domain and active) then
    raise exception 'Domain code % is not registered or is retired', p_domain;
  end if;
  perform pg_advisory_xact_lock(hashtext('doc_id:' || p_type || '-' || p_domain));
  select coalesce(max(seq), 0) + 1 into v_next
    from public.doc_ids where type_code = p_type and domain_code = p_domain;
  if v_next > 999 then
    raise exception 'Series %-% is full', p_type, p_domain;
  end if;
  v_id := p_type || '-' || p_domain || '-' || lpad(v_next::text, 3, '0');
  insert into public.doc_ids (doc_id, type_code, domain_code, seq, title, status, issued_by)
  values (v_id, p_type, p_domain, v_next, coalesce(p_title, ''), 'Reserved',
          coalesce(auth.jwt() ->> 'email', ''));
  return v_id;
end;
$$;

-- Same access model as every other table: any signed-in user, nobody else.
do $$
declare t text;
begin
  foreach t in array array['doc_types','doc_domains','doc_ids','registry_issues','registry_folders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "signed-in full access" on public.%I', t);
    execute format('create policy "signed-in full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select on public.doc_series to authenticated;
revoke execute on function public.allocate_doc_id(text, text, text) from public, anon;
grant execute on function public.allocate_doc_id(text, text, text) to authenticated;

-- Live refresh for the Registry view
do $$
begin
  begin alter publication supabase_realtime add table public.doc_ids; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.doc_domains; exception when duplicate_object then null; end;
end $$;
