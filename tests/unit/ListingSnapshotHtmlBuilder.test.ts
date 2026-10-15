import { describe, expect, it } from 'vitest';
import type { EnrichmentJob } from '../../src/domain/EnrichmentJob.js';
import { buildListingSnapshotHtml } from '../../src/storage/ListingSnapshotHtmlBuilder.js';

function job(overrides: Partial<EnrichmentJob> = {}): EnrichmentJob {
  return {
    researchId: 'jr1',
    seekUrl: 'https://au.seek.com/job/93621900',
    companyName: 'Expeditors International',
    jobTitle: 'Global Logistics - Operations Agent',
    descriptionHtml: '',
    contactEmail: '',
    permanentUrl: '',
    ...overrides,
  };
}

describe('buildListingSnapshotHtml', () => {
  it('puts the full job description in the GCS snapshot when captured', () => {
    const html = buildListingSnapshotHtml(
      job({
        descriptionHtml:
          '<p>We take care of our employees, and they take care of our customers!</p><p>Your new role</p>',
        contactEmail: 'hr@expeditors.example.com',
      })
    );
    expect(html).toContain('We take care of our employees');
    expect(html).toContain('Your new role');
    expect(html).toContain('Expeditors International');
    expect(html).toContain('hr@expeditors.example.com');
    expect(html).not.toContain('No description captured');
  });

  it('falls back to No description captured when the body was not scraped', () => {
    const html = buildListingSnapshotHtml(job());
    expect(html).toContain('No description captured');
    expect(html).toContain('Global Logistics - Operations Agent');
  });
});
