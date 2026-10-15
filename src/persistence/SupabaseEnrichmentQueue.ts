import type { SupabaseConfig } from './SupabaseConfig.js';

export const SEEK_JOB_ENRICHMENT_URLS_TABLE = 'seek_job_enrichment_urls';
/** Supabase returns at most this many rows per request. */
const PAGE_SIZE = 1000;

export type EnrichmentQueueRow = {
  url: string;
  researchId: string;
  companyName: string;
};

type EnrichmentQueueDbRow = {
  url?: string | null;
  research_id?: string | null;
  company_name?: string | null;
};

export type SupabaseEnrichmentQueueOptions = {
  config: SupabaseConfig;
  fetchImpl?: typeof fetch;
  table?: string;
};

/**
 * Read-only queue. One GET at the start of `npm run scrape`.
 * Linktal deactivates a row after a successful enrichment-ingest ping.
 */
export class SupabaseEnrichmentQueue {
  private readonly config: SupabaseConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly table: string;

  constructor(options: SupabaseEnrichmentQueueOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.table = options.table ?? SEEK_JOB_ENRICHMENT_URLS_TABLE;
  }

  private get endpoint(): string {
    return `${this.config.url}/rest/v1/${this.table}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.config.serviceRoleKey,
      Authorization: `Bearer ${this.config.serviceRoleKey}`,
      Accept: 'application/json',
      ...extra,
    };
  }

  async fetchActiveRows(): Promise<EnrichmentQueueRow[]> {
    const found: EnrichmentQueueRow[] = [];
    let offset = 0;
    const query =
      'select=url,research_id,company_name&is_active=eq.true&order=research_id.asc';

    for (;;) {
      const response = await this.fetchImpl(`${this.endpoint}?${query}`, {
        method: 'GET',
        headers: this.headers({
          Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        }),
      });

      if (response.status === 416) break;

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Supabase enrichment queue read failed (${response.status}): ${detail.slice(0, 300)}`
        );
      }

      const rows = (await response.json()) as EnrichmentQueueDbRow[];
      found.push(
        ...rows
          .filter(
            (row): row is EnrichmentQueueDbRow & { url: string; research_id: string } =>
              Boolean(row?.url?.trim() && row?.research_id?.trim())
          )
          .map((row) => ({
            url: row.url.trim(),
            researchId: row.research_id.trim(),
            companyName: row.company_name?.trim() ?? '',
          }))
      );

      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return found;
  }
}
