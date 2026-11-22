-- v0.1.12: effective date read from each document's file (cover table / script header).
-- Run in the Supabase SQL editor BEFORE installing v0.1.12 — the app writes this
-- column on every document save, so saves fail until it exists.
alter table public.documents
  add column if not exists effective_date text not null default '';
