import type { EnrichmentJob } from '../domain/EnrichmentJob.js';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** SRP: enrichment job → HTML snapshot stored in GCS. The description lives on this page. */
export function buildListingSnapshotHtml(job: EnrichmentJob): string {
  const title = escapeHtml(job.jobTitle || 'Job Listing');
  const company = escapeHtml(job.companyName || '');
  const state = escapeHtml(job.state || '');
  const suburbs = escapeHtml(job.suburbs || '');
  const salary = escapeHtml(job.salary || '');
  const posted = escapeHtml(job.posted || '');
  const contactEmail = escapeHtml(job.contactEmail || '');
  const originalUrl = escapeHtml(job.seekUrl || '');
  const description = job.descriptionHtml?.trim()
    ? job.descriptionHtml
    : '<p>No description captured.</p>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 24px auto; line-height: 1.6; color: #1f2937; padding: 0 16px; }
    h1 { margin-bottom: 12px; }
    .meta { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .meta li { margin: 4px 0; }
    .desc { margin-top: 16px; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <ul class="meta">
    ${company ? `<li><strong>Company:</strong> ${company}</li>` : ''}
    ${state ? `<li><strong>State:</strong> ${state}</li>` : ''}
    ${suburbs ? `<li><strong>Suburbs:</strong> ${suburbs}</li>` : ''}
    ${salary ? `<li><strong>Salary:</strong> ${salary}</li>` : ''}
    ${posted ? `<li><strong>Posted:</strong> ${posted}</li>` : ''}
    ${contactEmail ? `<li><strong>Email:</strong> ${contactEmail}</li>` : ''}
    ${originalUrl ? `<li><strong>Original URL:</strong> <a href="${originalUrl}">${originalUrl}</a></li>` : ''}
  </ul>
  <section class="desc">
    ${description}
  </section>
</body>
</html>`;
}

export function extractSeekJobId(raw: string | undefined): string {
  const text = String(raw || '').trim();
  const directMatch = text.match(/\/job\/(\d+)/i);
  if (directMatch?.[1]) return directMatch[1];
  if (/^\d+$/.test(text)) return text;
  const cleaned = text
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return cleaned || `job-${Date.now()}`;
}
