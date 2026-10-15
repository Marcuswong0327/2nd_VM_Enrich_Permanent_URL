import { describe, expect, it } from 'vitest';
import { SupabaseEnrichmentQueue } from '../../src/persistence/SupabaseEnrichmentQueue.js';

type CapturedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
};

function fakeSupabase(responses: Array<{ status?: number; body?: unknown }>) {
  const requests: CapturedRequest[] = [];

  const fetchImpl = (async (input: string, init: RequestInit = {}) => {
    requests.push({
      url: input,
      method: String(init.method ?? 'GET'),
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const reply = responses[requests.length - 1] ?? { status: 200, body: [] };
    return new Response(JSON.stringify(reply.body ?? []), { status: reply.status ?? 200 });
  }) as unknown as typeof fetch;

  return { requests, fetchImpl };
}

function queue(fetchImpl: typeof fetch) {
  return new SupabaseEnrichmentQueue({
    config: { url: 'https://abcd1234.supabase.co', serviceRoleKey: 'service-key' },
    fetchImpl,
  });
}

describe('SupabaseEnrichmentQueue', () => {
  it('reads url, research_id, and company_name where is_active is true', async () => {
    const { requests, fetchImpl } = fakeSupabase([
      {
        body: [
          {
            url: 'https://au.seek.com/job/123',
            research_id: 'jr1',
            company_name: 'Huon',
          },
          {
            url: 'https://au.seek.com/job/456',
            research_id: 'jr2',
            company_name: '  ',
          },
        ],
      },
    ]);

    const rows = await queue(fetchImpl).fetchActiveRows();

    expect(rows).toEqual([
      {
        url: 'https://au.seek.com/job/123',
        researchId: 'jr1',
        companyName: 'Huon',
      },
      {
        url: 'https://au.seek.com/job/456',
        researchId: 'jr2',
        companyName: '',
      },
    ]);
    expect(requests[0].url).toBe(
      'https://abcd1234.supabase.co/rest/v1/seek_job_enrichment_urls' +
        '?select=url,research_id,company_name&is_active=eq.true&order=research_id.asc'
    );
    expect(requests[0].method).toBe('GET');
    expect(requests[0].headers.apikey).toBe('service-key');
    expect(requests[0].headers.Authorization).toBe('Bearer service-key');
    expect(requests[0].headers.Range).toBe('0-999');
  });

  it('drops rows that have no url or research id', async () => {
    const { fetchImpl } = fakeSupabase([
      {
        body: [
          { url: 'https://au.seek.com/job/1', research_id: 'jr1', company_name: 'A' },
          { url: '', research_id: 'jr2', company_name: 'B' },
          { url: 'https://au.seek.com/job/3', research_id: '', company_name: 'C' },
        ],
      },
    ]);

    const rows = await queue(fetchImpl).fetchActiveRows();
    expect(rows).toEqual([
      { url: 'https://au.seek.com/job/1', researchId: 'jr1', companyName: 'A' },
    ]);
  });

  it('throws when the queue read fails', async () => {
    const { fetchImpl } = fakeSupabase([{ status: 500, body: { message: 'boom' } }]);
    await expect(queue(fetchImpl).fetchActiveRows()).rejects.toThrow(
      /Supabase enrichment queue read failed \(500\)/
    );
  });
});
