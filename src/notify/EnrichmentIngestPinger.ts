import type { EnrichmentIngestConfig } from './parseEnrichmentIngestConfig.js';

export type EnrichmentIngestJob = {
  researchId: string;
  seekUrl: string;
  permanentUrl: string;
  contactEmail: string;
};

export type EnrichmentIngestResult = {
  updated: number;
  missingResearchIds: string[];
};

export type EnrichmentIngestPingerOptions = {
  config: EnrichmentIngestConfig;
  fetchImpl?: typeof fetch;
};

/**
 * Adapter: POST finished ads to Linktal enrichment-ingest.
 * A non-2xx response throws so the caller leaves the queue row active.
 */
export class EnrichmentIngestPinger {
  private readonly config: EnrichmentIngestConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(options: EnrichmentIngestPingerOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async ping(jobs: EnrichmentIngestJob[]): Promise<EnrichmentIngestResult> {
    const response = await this.fetchImpl(this.config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ jobs }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Enrichment-ingest ping failed (${response.status}): ${detail.slice(0, 300)}`
      );
    }

    const data = (await response.json().catch(() => ({}))) as Partial<EnrichmentIngestResult>;
    return {
      updated: typeof data.updated === 'number' ? data.updated : 0,
      missingResearchIds: Array.isArray(data.missingResearchIds) ? data.missingResearchIds : [],
    };
  }
}
