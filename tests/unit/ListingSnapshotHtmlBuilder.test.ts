import { describe, expect, it } from 'vitest';
import type { EnrichmentJob } from '../../src/domain/EnrichmentJob.js';
import { buildListingSnapshotHtml } from '../../src/storage/ListingSnapshotHtmlBuilder.js';

function job(overrides: Partial<EnrichmentJob> = {}): EnrichmentJob {
  return {
    researchId: 'jr1',
    seekUrl: 'https://au.seek.com/job/93621900',
    companyName: 'Expeditors International',
    state: '',
    suburbs: '',
    salary: '',
    posted: '',
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

  it('prints state, suburbs, salary, and posted when the queue stored them', () => {
    const html = buildListingSnapshotHtml(
      job({
        state: 'Sydney (NSW)',
        suburbs: 'Silverwater',
        salary: 'salary + super + FMCV + bonus scheme',
        posted: '2026-08-12',
        descriptionHtml: '<p>We take care of our employees</p>',
      })
    );
    expect(html).toContain('<strong>State:</strong> Sydney (NSW)');
    expect(html).toContain('<strong>Suburbs:</strong> Silverwater');
    expect(html).toContain('<strong>Salary:</strong> salary + super + FMCV + bonus scheme');
    expect(html).toContain('<strong>Posted:</strong> 2026-08-12');
    expect(html).toContain('We take care of our employees');
  });

  it('omits blank card fields', () => {
    const html = buildListingSnapshotHtml(job({ descriptionHtml: '<p>Body</p>' }));
    expect(html).not.toContain('<strong>State:</strong>');
    expect(html).not.toContain('<strong>Suburbs:</strong>');
    expect(html).not.toContain('<strong>Salary:</strong>');
    expect(html).not.toContain('<strong>Posted:</strong>');
    expect(html).toContain('Body');
  });

  it('falls back to No description captured when the body was not scraped', () => {
    const html = buildListingSnapshotHtml(job());
    expect(html).toContain('No description captured');
    expect(html).toContain('Global Logistics - Operations Agent');
  });
});
