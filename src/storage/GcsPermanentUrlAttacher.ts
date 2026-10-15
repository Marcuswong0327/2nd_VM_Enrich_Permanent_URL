import type { EnrichmentJob } from '../domain/EnrichmentJob.js';
import type { IPermanentUrlAttacher } from '../ports/IPermanentUrlAttacher.js';
import { buildListingSnapshotHtml, extractSeekJobId } from './ListingSnapshotHtmlBuilder.js';

export const DEFAULT_GCS_UPLOAD_ENDPOINT =
  'https://upload-seek-job-5658707854.asia-southeast1.run.app';

export type GcsPermanentUrlAttacherOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  concurrency?: number;
};

/** Adapter: upload listing snapshot HTML to Cloud Run → GCS, set permanentUrl. */
export class GcsPermanentUrlAttacher implements IPermanentUrlAttacher {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly concurrency: number;

  constructor(options: GcsPermanentUrlAttacherOptions = {}) {
    this.endpoint =
      options.endpoint ??
      process.env.GCS_UPLOAD_ENDPOINT?.trim() ??
      DEFAULT_GCS_UPLOAD_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.concurrency = Math.max(1, options.concurrency ?? 10);
  }

  async attach(jobs: EnrichmentJob[]): Promise<EnrichmentJob[]> {
    if (jobs.length === 0) return [];
    const out = new Array<EnrichmentJob>(jobs.length);
    let next = 0;

    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= jobs.length) return;
        out[i] = await this.attachOne(jobs[i]);
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, jobs.length) || 1 }, () =>
      worker()
    );
    await Promise.all(workers);
    return out;
  }

  private async attachOne(job: EnrichmentJob): Promise<EnrichmentJob> {
    try {
      const jobId = extractSeekJobId(job.seekUrl);
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          markdownContent: buildListingSnapshotHtml(job),
        }),
      });
      if (!response.ok) {
        throw new Error(`GCS upload error ${response.status}`);
      }
      const data = (await response.json()) as { url?: string };
      if (!data?.url) {
        throw new Error('GCS upload succeeded but no permanent URL was returned');
      }
      return { ...job, permanentUrl: data.url };
    } catch {
      return { ...job, permanentUrl: job.permanentUrl || '' };
    }
  }
}
