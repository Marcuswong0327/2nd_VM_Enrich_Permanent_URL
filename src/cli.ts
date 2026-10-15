#!/usr/bin/env node
import 'dotenv/config';
import type { EnrichmentJob } from './domain/EnrichmentJob.js';
import { EnrichmentIngestPinger } from './notify/EnrichmentIngestPinger.js';
import { parseEnrichmentIngestConfig } from './notify/parseEnrichmentIngestConfig.js';
import { parseSupabaseConfig } from './persistence/SupabaseConfig.js';
import {
  SupabaseEnrichmentQueue,
  type EnrichmentQueueRow,
} from './persistence/SupabaseEnrichmentQueue.js';
import { DEFAULT_JOB_DETAIL_CONCURRENCY } from './scraping/jobDetailConcurrency.js';
import { PlaywrightJobDetailScraper } from './scraping/PlaywrightJobDetailScraper.js';
import { GcsPermanentUrlAttacher } from './storage/GcsPermanentUrlAttacher.js';

type JobOutcome = 'ok' | 'skipped' | 'failed' | 'missing';

function parseArgs(argv: string[]) {
  let headless = true;
  for (const arg of argv) {
    if (arg === '--headed') headless = false;
  }
  return { headless };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function enrichOne(
  row: EnrichmentQueueRow,
  scraper: PlaywrightJobDetailScraper,
  attacher: GcsPermanentUrlAttacher,
  pinger: EnrichmentIngestPinger
): Promise<JobOutcome> {
  let job: EnrichmentJob;
  try {
    const detail = await scraper.scrapeDetail(row.url);
    if (!detail.descriptionHtml.trim()) {
      console.error(`SKIP ${row.researchId}: no description (${row.url})`);
      return 'skipped';
    }
    job = {
      researchId: row.researchId,
      seekUrl: row.url,
      companyName: row.companyName,
      jobTitle: detail.jobTitle,
      descriptionHtml: detail.descriptionHtml,
      contactEmail: detail.contactEmail,
      permanentUrl: '',
    };
  } catch (err) {
    console.error(
      `FAIL ${row.researchId}: ${err instanceof Error ? err.message : String(err)}`
    );
    return 'failed';
  }

  const [uploaded] = await attacher.attach([job]);
  if (!uploaded.permanentUrl.trim()) {
    console.error(`SKIP ${row.researchId}: GCS upload failed (${row.url})`);
    return 'skipped';
  }

  try {
    const result = await pinger.ping([
      {
        researchId: uploaded.researchId,
        seekUrl: uploaded.seekUrl,
        permanentUrl: uploaded.permanentUrl,
        contactEmail: uploaded.contactEmail,
      },
    ]);
    if (result.missingResearchIds.includes(uploaded.researchId)) {
      console.error(
        `MISSING ${row.researchId}: Linktal has no research row; left active (${row.url})`
      );
      return 'missing';
    }
    console.log(`OK   ${row.researchId} → ${uploaded.permanentUrl}`);
    return 'ok';
  } catch (err) {
    console.error(
      `FAIL ${row.researchId}: ${err instanceof Error ? err.message : String(err)}`
    );
    return 'failed';
  }
}

async function main() {
  const { headless } = parseArgs(process.argv.slice(2));

  const supabase = parseSupabaseConfig(process.env);
  if (!supabase) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  const ingest = parseEnrichmentIngestConfig(process.env);
  if (!ingest) {
    throw new Error('Set ENRICHMENT_INGEST_URL and SCRAPE_COMPLETE_SECRET.');
  }

  const rows = await new SupabaseEnrichmentQueue({ config: supabase }).fetchActiveRows();
  if (rows.length === 0) {
    console.log('Nothing to scrape: no active rows in seek_job_enrichment_urls.');
    return;
  }

  console.log(`Enriching ${rows.length} active job page(s)…`);
  const scraper = new PlaywrightJobDetailScraper({
    headless,
    pagePoolSize: DEFAULT_JOB_DETAIL_CONCURRENCY,
  });
  const attacher = new GcsPermanentUrlAttacher();
  const pinger = new EnrichmentIngestPinger({ config: ingest });

  try {
    const outcomes = await mapPool(rows, DEFAULT_JOB_DETAIL_CONCURRENCY, (row) =>
      enrichOne(row, scraper, attacher, pinger)
    );
    const count = (kind: JobOutcome) => outcomes.filter((outcome) => outcome === kind).length;
    console.log(
      `Done: ${count('ok')} pinged, ${count('skipped')} skipped, ${count('failed')} failed, ${count('missing')} missing.`
    );
  } finally {
    await scraper.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
