# 2nd VM Enrich Permanent URL

One-shot Seek job-page enricher. `npm run scrape` reads active rows from Supabase `seek_job_enrichment_urls`, opens each job page, uploads a description snapshot to GCS, and POSTs the permanent URL and contact email to Linktal.

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run scrape
```

`--headed` opens a visible browser. An empty queue exits 0. Rows that fail to produce a permanent URL are left active for the next run. Linktal sets `is_active` to false after a successful ping.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

`npm run check` runs lint, then typecheck, then test.
