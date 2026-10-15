import { describe, expect, it } from 'vitest';
import { parseSeekJobDetailHtml } from '../../src/parsing/SeekJobDetailParser.js';

const sampleDetail = `
<div data-automation="job-view-container">
  <h1 data-automation="job-detail-title">Global Logistics - Operations Agent</h1>
  <span data-automation="advertiser-name">Expeditors International</span>
  <div data-automation="jobAdDetails">
    <p>We take care of our employees, and they take care of our customers!</p>
    <p><strong>Your new role</strong></p>
    <p>Become a member of a global community.</p>
    <p>Apply via hr@expeditors.example.com</p>
  </div>
</div>
`;

describe('parseSeekJobDetailHtml', () => {
  it('extracts full job description HTML, contact email, and title from a Seek job page', () => {
    const detail = parseSeekJobDetailHtml(sampleDetail);
    expect(detail.descriptionHtml).toContain('We take care of our employees');
    expect(detail.descriptionHtml).toContain('Your new role');
    expect(detail.contactEmail).toBe('hr@expeditors.example.com');
    expect(detail.jobTitle).toBe('Global Logistics - Operations Agent');
  });

  it('returns empty description when the ad body is missing', () => {
    const detail = parseSeekJobDetailHtml('<html><body><h1>Empty</h1></body></html>');
    expect(detail.descriptionHtml).toBe('');
    expect(detail.contactEmail).toBe('');
    expect(detail.jobTitle).toBe('Empty');
  });

  it('falls back to JobPosting JSON-LD when jobAdDetails is not in the HTML', () => {
    const detail = parseSeekJobDetailHtml(`<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'http://schema.org',
        '@type': 'JobPosting',
        description: '<p>We take care of our employees, and they take care of our customers!</p>',
      })}</script>
    </head><body><h1>Global Logistics - Operations Agent</h1></body></html>`);
    expect(detail.descriptionHtml).toContain('We take care of our employees');
    expect(detail.jobTitle).toBe('Global Logistics - Operations Agent');
  });
});
