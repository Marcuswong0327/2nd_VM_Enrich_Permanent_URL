import type { EnrichmentJob } from '../domain/EnrichmentJob.js';

/** DIP: the scrape pipeline depends on this, not GCS HTTP. */
export interface IPermanentUrlAttacher {
  attach(jobs: EnrichmentJob[]): Promise<EnrichmentJob[]>;
}
