import { describe, expect, it, vi } from 'vitest';
import type { EnrichmentJob } from '../../src/domain/EnrichmentJob.js';
import { GcsPermanentUrlAttacher } from '../../src/storage/GcsPermanentUrlAttacher.js';

function job(overrides: Partial<EnrichmentJob> = {}): EnrichmentJob {
  return {
    researchId: 'jr1',
    seekUrl: 'https://www.au.seek.com/job/91086625',
    companyName: 'William Adams Pty Ltd',
    jobTitle: 'Plant Mechanic',
    descriptionHtml: '',
    contactEmail: '',
    permanentUrl: '',
    ...overrides,
  };
}

describe('GcsPermanentUrlAttacher', () => {
  it('uploads snapshot HTML and sets permanentUrl from GCS', async () => {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ url: 'https://storage.googleapis.com/seek-jobs/91086625.html' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const attacher = new GcsPermanentUrlAttacher({
      endpoint: 'https://upload.example.run.app',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const [uploaded] = await attacher.attach([job()]);

    expect(uploaded.permanentUrl).toBe('https://storage.googleapis.com/seek-jobs/91086625.html');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://upload.example.run.app');
    const body = JSON.parse(String(init?.body));
    expect(body.jobId).toBe('91086625');
    expect(body.markdownContent).toContain('Plant Mechanic');
    expect(body.markdownContent).toContain('https://www.au.seek.com/job/91086625');
    expect(body.markdownContent).toContain('William Adams Pty Ltd');
  });

  it('includes the full job description in the uploaded snapshot', async () => {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ url: 'https://storage.googleapis.com/seek-jobs/91086625.html' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const attacher = new GcsPermanentUrlAttacher({
      endpoint: 'https://upload.example.run.app',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await attacher.attach([
      job({ descriptionHtml: '<p>We take care of our employees</p>' }),
    ]);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.markdownContent).toContain('We take care of our employees');
    expect(body.markdownContent).not.toContain('No description captured');
  });

  it('leaves permanentUrl blank when upload fails', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    const attacher = new GcsPermanentUrlAttacher({
      endpoint: 'https://upload.example.run.app',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const [uploaded] = await attacher.attach([job()]);
    expect(uploaded.permanentUrl).toBe('');
    expect(uploaded.seekUrl).toBe('https://www.au.seek.com/job/91086625');
  });
});
