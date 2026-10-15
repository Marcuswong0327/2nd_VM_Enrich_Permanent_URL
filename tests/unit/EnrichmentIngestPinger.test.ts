import { describe, expect, it, vi } from 'vitest';
import { EnrichmentIngestPinger } from '../../src/notify/EnrichmentIngestPinger.js';

const job = {
  researchId: 'jr1',
  seekUrl: 'https://au.seek.com/job/123',
  permanentUrl: 'https://files.example/archive/123',
  contactEmail: 'hr@company.com',
};

describe('EnrichmentIngestPinger', () => {
  it('POSTs jobs with the scrape bearer and returns the ingest result', async () => {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ updated: 1, missingResearchIds: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const pinger = new EnrichmentIngestPinger({
      config: {
        url: 'https://api.example/api/job-research/enrichment-ingest',
        secret: 'shared-secret',
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await pinger.ping([job]);

    expect(result).toEqual({ updated: 1, missingResearchIds: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example/api/job-research/enrichment-ingest');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer shared-secret');
    expect(JSON.parse(String(init?.body))).toEqual({ jobs: [job] });
  });

  it('throws on a non-2xx response so the queue row stays active', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const pinger = new EnrichmentIngestPinger({
      config: { url: 'https://api.example/api/job-research/enrichment-ingest', secret: 'nope' },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(pinger.ping([job])).rejects.toThrow(/Enrichment-ingest ping failed \(401\)/);
  });
});
