-- One-time table the second VM reads. This process does not run this file.
-- Linktal inserts url, research_id, company_name, state, suburbs, salary, and posted on Save.
-- posted is YYYY-MM-DD, or '' when the research row has no postedDate.
-- is_active defaults to true because that insert does not send the flag.
-- research_id is unique so a later Save can reactivate a finished row (HTTP 409).
-- After a successful enrichment-ingest, Linktal sets is_active = false and last_scraped_at = now.

create table if not exists public.seek_job_enrichment_urls (
  research_id text primary key,
  url text not null,
  company_name text not null default '',
  state text not null default '',
  suburbs text not null default '',
  salary text not null default '',
  posted text not null default '',
  is_active boolean not null default true,
  last_scraped_at timestamptz,
  created_at timestamptz not null default now()
);
