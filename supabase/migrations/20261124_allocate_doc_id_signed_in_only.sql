-- Functions are executable by everyone by default. allocate_doc_id runs as the
-- caller, so an anonymous call already couldn't read or write anything (RLS), but
-- only signed-in users should be able to call it at all. Already folded into
-- 20261123_doc_id_registry.sql for fresh installs; run this once where that file
-- was run before the fix.
revoke execute on function public.allocate_doc_id(text, text, text) from public, anon;
grant execute on function public.allocate_doc_id(text, text, text) to authenticated;
